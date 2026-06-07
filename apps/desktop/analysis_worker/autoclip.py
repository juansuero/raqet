#!/usr/bin/env python3
import argparse
import json
import math
import statistics
import subprocess
import sys
from array import array


FRAME_WIDTH = 160
FRAME_HEIGHT = 90
FRAME_RATE = 2
FRAME_BYTES = FRAME_WIDTH * FRAME_HEIGHT


def run_bytes(command):
    try:
        return subprocess.check_output(command, stderr=subprocess.DEVNULL)
    except FileNotFoundError as error:
        raise RuntimeError("ffmpeg and ffprobe must be available on PATH for auto clipping.") from error
    except subprocess.CalledProcessError as error:
        raise RuntimeError("Video analysis failed while reading the source video.") from error


def probe_duration_ms(video_path):
    output = run_bytes([
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        video_path,
    ])
    return int(round(float(output.decode("utf-8").strip()) * 1000))


def percentile(values, percentile_value):
    if not values:
        return 0.0
    ordered = sorted(values)
    index = (len(ordered) - 1) * percentile_value
    lower = math.floor(index)
    upper = math.ceil(index)
    if lower == upper:
        return ordered[int(index)]
    return ordered[lower] * (upper - index) + ordered[upper] * (index - lower)


def frame_motion_scores(video_path):
    output = run_bytes([
        "ffmpeg",
        "-hide_banner",
        "-i",
        video_path,
        "-vf",
        f"fps={FRAME_RATE},scale={FRAME_WIDTH}:{FRAME_HEIGHT},format=gray",
        "-an",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "gray",
        "-",
    ])

    scores = []
    previous = None
    frame_count = len(output) // FRAME_BYTES
    for index in range(frame_count):
        start = index * FRAME_BYTES
        frame = output[start:start + FRAME_BYTES]
        timestamp_ms = int(round((index / FRAME_RATE) * 1000))
        if previous is None:
            scores.append((timestamp_ms, 0.0))
        else:
            diff = sum(abs(current - last) for current, last in zip(frame, previous)) / (FRAME_BYTES * 255)
            scores.append((timestamp_ms, diff))
        previous = frame
    return scores


def audio_energy_scores(video_path, duration_ms):
    sample_rate = 100
    samples_per_bucket = 50
    output = run_bytes([
        "ffmpeg",
        "-hide_banner",
        "-i",
        video_path,
        "-vn",
        "-ac",
        "1",
        "-ar",
        str(sample_rate),
        "-f",
        "s16le",
        "-",
    ])
    samples = array("h")
    samples.frombytes(output)
    if sys.byteorder != "little":
        samples.byteswap()

    scores = []
    bucket_index = 0
    for offset in range(0, len(samples), samples_per_bucket):
        bucket = samples[offset:offset + samples_per_bucket]
        if not bucket:
            continue
        rms = math.sqrt(sum(sample * sample for sample in bucket) / len(bucket)) / 32768
        timestamp_ms = int(round(bucket_index * samples_per_bucket / sample_rate * 1000))
        if timestamp_ms <= duration_ms:
            scores.append((timestamp_ms, rms))
        bucket_index += 1
    return scores


def normalize_series(scores):
    values = [score for _, score in scores]
    low = percentile(values, 0.15)
    high = percentile(values, 0.92)
    span = max(high - low, 0.000001)
    return [(timestamp, max(0.0, min(1.0, (score - low) / span))) for timestamp, score in scores]


def value_at(scores, timestamp_ms):
    if not scores:
        return 0.0
    index = min(len(scores) - 1, max(0, round(timestamp_ms / 500)))
    return scores[index][1]


def scene_boundaries_from_motion(motion_scores, duration_ms):
    values = [score for _, score in motion_scores]
    if len(values) < 4:
        return []
    median = statistics.median(values)
    p90 = percentile(values, 0.90)
    p97 = percentile(values, 0.97)
    threshold = max(p97, median + (p90 - median) * 2.4, 0.16)
    boundaries = []
    for timestamp_ms, score in motion_scores:
        if score >= threshold and 2500 < timestamp_ms < duration_ms - 2500:
            if not boundaries or timestamp_ms - boundaries[-1] >= 2500:
                boundaries.append(timestamp_ms)
    return boundaries


def ranges_from_boundaries(boundaries, duration_ms):
    if not boundaries:
        return []
    points = [0] + boundaries + [duration_ms]
    ranges = []
    for start, end in zip(points, points[1:]):
        start_ms = max(0, start - 800)
        end_ms = min(duration_ms, end + 800)
        length = end_ms - start_ms
        if 3000 <= length <= 90000:
            ranges.append({
                "start_ms": start_ms,
                "end_ms": end_ms,
                "confidence": 0.68,
                "source": "scene-motion",
            })
    return ranges


def smooth_boolean(active, fill_gap_steps=6, min_run_steps=6):
    smoothed = active[:]
    index = 0
    while index < len(smoothed):
        if smoothed[index]:
            index += 1
            continue
        start = index
        while index < len(smoothed) and not smoothed[index]:
            index += 1
        if 0 < start and index < len(smoothed) and index - start <= fill_gap_steps:
            for fill_index in range(start, index):
                smoothed[fill_index] = True

    index = 0
    while index < len(smoothed):
        if not smoothed[index]:
            index += 1
            continue
        start = index
        while index < len(smoothed) and smoothed[index]:
            index += 1
        if index - start < min_run_steps:
            for clear_index in range(start, index):
                smoothed[clear_index] = False
    return smoothed


def ranges_from_activity(motion_scores, audio_scores, duration_ms):
    motion_normalized = normalize_series(motion_scores)
    audio_normalized = normalize_series(audio_scores)
    step_ms = 500
    combined = []
    for timestamp_ms in range(0, duration_ms + step_ms, step_ms):
        motion = value_at(motion_normalized, timestamp_ms)
        audio = value_at(audio_normalized, timestamp_ms)
        combined.append((timestamp_ms, motion * 0.78 + audio * 0.22))

    values = [score for _, score in combined]
    threshold = max(0.36, percentile(values, 0.58))
    active = [score >= threshold for _, score in combined]
    active = smooth_boolean(active)

    ranges = []
    index = 0
    while index < len(active):
        if not active[index]:
            index += 1
            continue
        start_index = index
        while index < len(active) and active[index]:
            index += 1
        end_index = index - 1
        start_ms = max(0, combined[start_index][0] - 1500)
        end_ms = min(duration_ms, combined[end_index][0] + 2500)
        length = end_ms - start_ms
        if 3500 <= length <= 90000:
            ranges.append({
                "start_ms": start_ms,
                "end_ms": end_ms,
                "confidence": 0.58,
                "source": "motion-audio",
            })
    return ranges


def dedupe_ranges(ranges):
    ranges = sorted(ranges, key=lambda item: (item["start_ms"], item["end_ms"]))
    deduped = []
    for item in ranges:
        if deduped and abs(item["start_ms"] - deduped[-1]["start_ms"]) < 1500 and abs(item["end_ms"] - deduped[-1]["end_ms"]) < 2500:
            if item["confidence"] > deduped[-1]["confidence"]:
                deduped[-1] = item
            continue
        deduped.append(item)
    return deduped


def analyze(video_path):
    duration_ms = probe_duration_ms(video_path)
    motion_scores = frame_motion_scores(video_path)
    audio_scores = audio_energy_scores(video_path, duration_ms)

    boundaries = scene_boundaries_from_motion(motion_scores, duration_ms)
    boundary_ranges = ranges_from_boundaries(boundaries, duration_ms)
    activity_ranges = ranges_from_activity(motion_scores, audio_scores, duration_ms)
    ranges = boundary_ranges if len(boundary_ranges) >= 2 else activity_ranges

    return {
        "duration_ms": duration_ms,
        "motion_samples": len(motion_scores),
        "audio_samples": len(audio_scores),
        "ranges": dedupe_ranges(ranges)[:120],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("video_path")
    args = parser.parse_args()
    print(json.dumps(analyze(args.video_path)))


if __name__ == "__main__":
    main()
