#!/usr/bin/env python3
import argparse
import json
import math
import os
import subprocess
from pathlib import Path


TARGET_WIDTH = 1080
TARGET_HEIGHT = 1920
MODEL_NAME = os.environ.get("RAQET_YOLO_MODEL", "yolo11n.pt")


def require_dependencies():
    try:
        import cv2
        from ultralytics import YOLO
    except Exception as error:
        raise RuntimeError(
            "Advanced reel tracking requires Python packages: ultralytics and opencv-python. "
            "Install with `python -m pip install ultralytics opencv-python`."
        ) from error
    return cv2, YOLO


def run(command):
    try:
        return subprocess.run(command, check=True, capture_output=True)
    except FileNotFoundError as error:
        raise RuntimeError("ffmpeg and ffprobe must be available on PATH for reel export.") from error
    except subprocess.CalledProcessError as error:
        stderr = error.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(stderr or "ffmpeg failed during reel export.") from error


def probe_video(path):
    result = run([
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height,r_frame_rate",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        path,
    ])
    data = json.loads(result.stdout.decode("utf-8"))
    stream = data["streams"][0]
    duration = float(data["format"]["duration"])
    numerator, denominator = str(stream.get("r_frame_rate", "30/1")).split("/")
    fps = float(numerator) / max(1.0, float(denominator))
    return int(stream["width"]), int(stream["height"]), duration, fps


def percentile(values, pct):
    if not values:
        return 0
    ordered = sorted(values)
    index = (len(ordered) - 1) * pct
    low = math.floor(index)
    high = math.ceil(index)
    if low == high:
        return ordered[low]
    return ordered[low] * (high - index) + ordered[high] * (index - low)


def smooth_series(points, radius):
    smoothed = []
    for index, (timestamp, _) in enumerate(points):
        start = max(0, index - radius)
        end = min(len(points), index + radius + 1)
        smoothed.append((timestamp, percentile([value for _, value in points[start:end]], 0.5)))
    return smoothed


def detect_near_player_centers(source, start_seconds, duration_seconds):
    cv2, YOLO = require_dependencies()
    width, height, _, fps = probe_video(source)
    model = YOLO(MODEL_NAME)
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise RuntimeError("Could not open source video for YOLO reel tracking.")

    start_frame = int(round(start_seconds * fps))
    end_frame = int(round((start_seconds + duration_seconds) * fps))
    step = max(1, int(round(fps / 18)))
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

    selected_track_id = None
    previous_x = width / 2
    centers = []
    frame_index = start_frame
    missed = 0

    while frame_index <= end_frame:
        success, frame = cap.read()
        if not success:
            break

        if (frame_index - start_frame) % step != 0:
            frame_index += 1
            continue

        timestamp = (frame_index - start_frame) / fps
        result = model.track(
            frame,
            persist=True,
            classes=[0],
            conf=0.20,
            iou=0.45,
            tracker="bytetrack.yaml",
            verbose=False,
        )[0]

        detections = []
        boxes = result.boxes
        if boxes is not None and len(boxes) > 0:
            xyxy = boxes.xyxy.cpu().tolist()
            confs = boxes.conf.cpu().tolist() if boxes.conf is not None else [0.5] * len(xyxy)
            ids = boxes.id.int().cpu().tolist() if boxes.id is not None else [None] * len(xyxy)
            for box, confidence, track_id in zip(xyxy, confs, ids):
                x1, y1, x2, y2 = box
                box_width = max(1.0, x2 - x1)
                box_height = max(1.0, y2 - y1)
                center_x = (x1 + x2) / 2
                center_y = (y1 + y2) / 2
                if center_y < height * 0.32:
                    continue
                area = box_width * box_height
                near_bias = (center_y / height) ** 2.1
                size_bias = math.sqrt(area / max(1, width * height))
                continuity = 1.0 - min(1.0, abs(center_x - previous_x) / width)
                score = confidence * 0.30 + near_bias * 0.42 + size_bias * 0.18 + continuity * 0.10
                detections.append({
                    "track_id": track_id,
                    "center_x": center_x,
                    "score": score,
                    "center_y": center_y,
                    "area": area,
                })

        chosen = None
        if selected_track_id is not None:
            same_track = [item for item in detections if item["track_id"] == selected_track_id]
            if same_track:
                chosen = max(same_track, key=lambda item: item["score"])
        if chosen is None and detections:
            chosen = max(detections, key=lambda item: item["score"])
            if chosen["track_id"] is not None and (selected_track_id is None or missed > 6):
                selected_track_id = chosen["track_id"]

        if chosen is None:
            missed += 1
            centers.append((timestamp, previous_x))
        else:
            missed = 0
            previous_x = previous_x * 0.62 + chosen["center_x"] * 0.38
            centers.append((timestamp, previous_x))

        frame_index += 1

    cap.release()
    if len(centers) < 3:
        raise RuntimeError("YOLO did not detect a reliable near-side player track in this clip.")

    return centers, width, height


def crop_path_from_centers(centers, width, height):
    crop_width = min(width, int(round(height * 9 / 16)))
    if crop_width % 2:
        crop_width -= 1
    max_x = max(0, width - crop_width)
    targets = [(timestamp, max(0, min(max_x, center_x - crop_width * 0.52))) for timestamp, center_x in centers]
    targets = smooth_series(targets, radius=3)

    lookahead = []
    for index, (timestamp, _) in enumerate(targets):
        end = min(len(targets), index + 5)
        average = sum(value for _, value in targets[index:end]) / max(1, end - index)
        lookahead.append((timestamp, average))

    current = lookahead[0][1]
    velocity = 0.0
    last_timestamp = lookahead[0][0]
    max_speed = max(780, crop_width * 1.85)
    max_accel = max(1700, crop_width * 3.6)
    path = []
    for timestamp, target in lookahead:
        elapsed = max(1 / 30, timestamp - last_timestamp)
        distance = target - current
        desired_velocity = max(-max_speed, min(max_speed, distance / max(0.16, elapsed * 4.5)))
        velocity_delta = max(-max_accel * elapsed, min(max_accel * elapsed, desired_velocity - velocity))
        velocity = (velocity + velocity_delta) * 0.88
        if abs(distance) < crop_width * 0.018 and abs(velocity) < 45:
            velocity *= 0.45
        current = max(0, min(max_x, current + velocity * elapsed))
        path.append((timestamp, current))
        last_timestamp = timestamp
    return path, crop_width, height if height % 2 == 0 else height - 1


def resample_keyframes(path, duration_seconds):
    interval = max(0.20, min(0.45, duration_seconds / 70))
    keyframes = []
    timestamp = 0.0
    while timestamp < duration_seconds:
        nearest = min(path, key=lambda item: abs(item[0] - timestamp))
        keyframes.append((timestamp, int(round(nearest[1] / 2) * 2)))
        timestamp += interval
    keyframes.append((duration_seconds, int(round(path[-1][1] / 2) * 2)))
    return keyframes


def smoothstep_expression(t0, t1):
    span = max(0.001, t1 - t0)
    progress = f"((t-{t0:.3f})/{span:.3f})"
    return f"({progress}*{progress}*(3-2*{progress}))"


def ffmpeg_crop_expression(keyframes, max_x):
    expression = str(keyframes[-1][1])
    for index in range(len(keyframes) - 2, -1, -1):
        t0, x0 = keyframes[index]
        t1, x1 = keyframes[index + 1]
        easing = smoothstep_expression(t0, t1)
        segment = f"({x0}+({x1 - x0})*{easing})"
        expression = f"if(lt(t\\,{t1:.3f})\\,{segment}\\,{expression})"
    return f"min({max_x}\\,max(0\\,2*floor(({expression})/2)))"


def export_reel(source, output, start_seconds, duration_seconds, path, crop_width, crop_height, source_width):
    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    max_x = max(0, source_width - crop_width)
    crop_x = ffmpeg_crop_expression(resample_keyframes(path, duration_seconds), max_x)
    filter_chain = (
        f"crop={crop_width}:{crop_height}:{crop_x}:0,"
        f"scale={TARGET_WIDTH}:{TARGET_HEIGHT}:force_original_aspect_ratio=increase,"
        f"crop={TARGET_WIDTH}:{TARGET_HEIGHT},setsar=1"
    )
    run([
        "ffmpeg",
        "-y",
        "-ss",
        f"{start_seconds:.3f}",
        "-i",
        source,
        "-t",
        f"{duration_seconds:.3f}",
        "-vf",
        filter_chain,
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        str(output_path),
    ])
    return str(output_path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--start-ms", required=True, type=int)
    parser.add_argument("--end-ms", required=True, type=int)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    _, _, source_duration, _ = probe_video(args.source)
    start_seconds = max(0.0, args.start_ms / 1000)
    end_seconds = min(source_duration, max(start_seconds + 0.1, args.end_ms / 1000))
    duration_seconds = end_seconds - start_seconds
    centers, width, height = detect_near_player_centers(args.source, start_seconds, duration_seconds)
    path, crop_width, crop_height = crop_path_from_centers(centers, width, height)
    output = export_reel(args.source, args.output, start_seconds, duration_seconds, path, crop_width, crop_height, width)
    print(json.dumps({
        "output": output,
        "tracker": "yolo",
        "model": MODEL_NAME,
        "detections": len(centers),
        "target": f"{TARGET_WIDTH}x{TARGET_HEIGHT}",
    }))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        raise SystemExit(str(error))
