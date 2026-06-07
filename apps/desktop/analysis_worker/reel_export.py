#!/usr/bin/env python3
import argparse
import json
import math
import subprocess
from pathlib import Path


ANALYSIS_WIDTH = 320
ANALYSIS_FPS = 30
KEYFRAME_INTERVAL_SECONDS = 0.15
TARGET_WIDTH = 1080
TARGET_HEIGHT = 1920


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
        "stream=width,height",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        path,
    ])
    data = json.loads(result.stdout.decode("utf-8"))
    stream = data["streams"][0]
    duration = float(data["format"]["duration"])
    return int(stream["width"]), int(stream["height"]), duration


def read_analysis_frames(path, start_seconds, duration_seconds, width, height):
    analysis_height = max(90, int(round(height * (ANALYSIS_WIDTH / width))))
    if analysis_height % 2:
        analysis_height += 1
    result = run([
        "ffmpeg",
        "-hide_banner",
        "-ss",
        f"{start_seconds:.3f}",
        "-i",
        path,
        "-t",
        f"{duration_seconds:.3f}",
        "-vf",
        f"fps={ANALYSIS_FPS},scale={ANALYSIS_WIDTH}:{analysis_height},format=gray",
        "-an",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "gray",
        "-",
    ])
    frame_size = ANALYSIS_WIDTH * analysis_height
    frames = []
    raw = result.stdout
    for index in range(len(raw) // frame_size):
        start = index * frame_size
        frames.append(raw[start:start + frame_size])
    return frames, analysis_height


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


def blur_columns(values, radius=5):
    blurred = []
    for index in range(len(values)):
        start = max(0, index - radius)
        end = min(len(values), index + radius + 1)
        blurred.append(sum(values[start:end]) / max(1, end - start))
    return blurred


def motion_centers(frames, analysis_height, source_width):
    centers = []
    previous = None
    y_start = int(analysis_height * 0.45)
    scale_x = source_width / ANALYSIS_WIDTH
    previous_x = ANALYSIS_WIDTH / 2

    for index, frame in enumerate(frames):
        timestamp = index / ANALYSIS_FPS
        if previous is None:
            centers.append((timestamp, source_width / 2))
            previous = frame
            continue

        column_energy = [0.0] * ANALYSIS_WIDTH
        for y in range(y_start, analysis_height):
            row_offset = y * ANALYSIS_WIDTH
            vertical_weight = 1.0 + ((y - y_start) / max(1, analysis_height - y_start)) * 0.8
            for x in range(ANALYSIS_WIDTH):
                diff = abs(frame[row_offset + x] - previous[row_offset + x])
                if diff > 8:
                    column_energy[x] += (diff * diff) * vertical_weight

        total_energy = sum(column_energy)
        if total_energy <= 0:
            centers.append((timestamp, centers[-1][1] if centers else source_width / 2))
            previous = frame
            continue

        column_energy = blur_columns(column_energy, radius=6)
        peak = max(column_energy)
        floor = percentile(column_energy, 0.55)
        if peak < max(1200, floor * 1.35):
            centers.append((timestamp, centers[-1][1] if centers else source_width / 2))
            previous = frame
            continue

        best_x = previous_x
        best_score = -1e18
        for x, energy in enumerate(column_energy):
            distance_penalty = abs(x - previous_x) * peak * 0.006
            center_bias = abs(x - ANALYSIS_WIDTH / 2) * peak * 0.0008
            score = energy - distance_penalty - center_bias
            if score > best_score:
                best_score = score
                best_x = x

        previous_x = previous_x * 0.72 + best_x * 0.28
        center = previous_x * scale_x
        centers.append((timestamp, center))
        previous = frame

    return centers


def smooth_crop_positions(centers, source_width, source_height):
    crop_width = min(source_width, int(round(source_height * 9 / 16)))
    max_x = max(0, source_width - crop_width)
    if not centers:
        return [(0.0, max_x / 2)], crop_width

    target_positions = [(timestamp, max(0, min(max_x, center - crop_width / 2))) for timestamp, center in centers]
    medianed = []
    for index, (timestamp, _) in enumerate(target_positions):
        start = max(0, index - 3)
        end = min(len(target_positions), index + 4)
        medianed.append((timestamp, percentile([position for _, position in target_positions[start:end]], 0.5)))

    smoothed = []
    current = medianed[0][1]
    max_pan_per_second = max(900, crop_width * 2.6)
    last_timestamp = medianed[0][0]
    for timestamp, center in centers:
        target = medianed[min(len(medianed) - 1, len(smoothed))][1]
        elapsed = max(1 / ANALYSIS_FPS, timestamp - last_timestamp)
        max_step = max_pan_per_second * elapsed
        delta = target - current
        distance = abs(delta)
        if distance < crop_width * 0.01:
            delta = 0
        response = 0.28
        if distance > crop_width * 0.45:
            response = 0.78
        elif distance > crop_width * 0.25:
            response = 0.58
        elif distance > crop_width * 0.10:
            response = 0.42
        delta = max(-max_step, min(max_step, delta))
        current = current + delta * response
        smoothed.append((timestamp, current))
        last_timestamp = timestamp
    return smoothed, crop_width


def resample_keyframes(crop_path, duration_seconds):
    if not crop_path:
        return [(0.0, 0)]
    keyframes = []
    timestamp = 0.0
    while timestamp < duration_seconds:
        nearest = min(crop_path, key=lambda item: abs(item[0] - timestamp))
        keyframes.append((timestamp, int(round(nearest[1]))))
        timestamp += KEYFRAME_INTERVAL_SECONDS
    keyframes.append((duration_seconds, int(round(crop_path[-1][1]))))
    return keyframes


def smoothstep_expression(t0, t1):
    span = max(0.001, t1 - t0)
    progress = f"((t-{t0:.3f})/{span:.3f})"
    return f"({progress}*{progress}*(3-2*{progress}))"


def ffmpeg_crop_expression(keyframes):
    if len(keyframes) == 1:
        return str(keyframes[0][1])

    expression = str(keyframes[-1][1])
    for index in range(len(keyframes) - 2, -1, -1):
        t0, x0 = keyframes[index]
        t1, x1 = keyframes[index + 1]
        easing = smoothstep_expression(t0, t1)
        segment = f"({x0}+({x1 - x0})*{easing})"
        expression = f"if(lt(t\\,{t1:.3f})\\,{segment}\\,{expression})"
    return expression


def export_continuous_reel(source, output, start_seconds, duration_seconds, crop_path, crop_width, source_height):
    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    keyframes = resample_keyframes(crop_path, duration_seconds)
    crop_x = ffmpeg_crop_expression(keyframes)
    filter_chain = (
        f"crop={crop_width}:{source_height}:{crop_x}:0,"
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
    return str(output_path), len(keyframes)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--start-ms", required=True, type=int)
    parser.add_argument("--end-ms", required=True, type=int)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    width, height, source_duration = probe_video(args.source)
    start_seconds = max(0.0, args.start_ms / 1000)
    requested_end = max(start_seconds + 0.1, args.end_ms / 1000)
    end_seconds = min(source_duration, requested_end)
    duration_seconds = max(0.1, end_seconds - start_seconds)

    frames, analysis_height = read_analysis_frames(args.source, start_seconds, duration_seconds, width, height)
    centers = motion_centers(frames, analysis_height, width)
    crop_path, crop_width = smooth_crop_positions(centers, width, height)
    output, keyframes = export_continuous_reel(args.source, args.output, start_seconds, duration_seconds, crop_path, crop_width, height)
    print(json.dumps({
        "output": output,
        "keyframes": keyframes,
        "cropWidth": crop_width,
        "target": f"{TARGET_WIDTH}x{TARGET_HEIGHT}",
    }))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        raise SystemExit(str(error))
