use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct LibraryState {
    #[serde(default)]
    sessions: Vec<Session>,
    #[serde(default)]
    videos: Vec<LocalVideo>,
    #[serde(default)]
    clips: Vec<Clip>,
    #[serde(default)]
    candidate_clips: Vec<CandidateClip>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Session {
    id: String,
    title: String,
    notes: String,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct LocalVideo {
    id: String,
    #[serde(default)]
    session_id: Option<String>,
    file_path: String,
    #[serde(default)]
    preview_file_path: Option<String>,
    file_name: String,
    duration_ms: Option<u64>,
    imported_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Clip {
    id: String,
    #[serde(default)]
    session_id: Option<String>,
    local_video_id: String,
    start_ms: u64,
    end_ms: u64,
    title: String,
    exported_clip_path: Option<String>,
    point_result: String,
    point_ending: String,
    shot_context: String,
    notes: String,
    tags: Vec<String>,
    #[serde(default)]
    events: Vec<ClipEvent>,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ClipEvent {
    id: String,
    timestamp_ms: u64,
    action: String,
    note: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CandidateClip {
    id: String,
    #[serde(default)]
    session_id: Option<String>,
    local_video_id: String,
    start_ms: u64,
    end_ms: u64,
    status: String,
    #[serde(default)]
    source: Option<String>,
    #[serde(default)]
    confidence: Option<f64>,
    created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateClipInput {
    local_video_id: String,
    session_id: Option<String>,
    start_ms: u64,
    end_ms: u64,
    title: String,
    point_result: String,
    point_ending: String,
    shot_context: String,
    notes: String,
    tags: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateSessionInput {
    title: String,
    notes: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateSessionInput {
    session_id: String,
    title: String,
    notes: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateClipInput {
    clip_id: String,
    title: String,
    point_result: String,
    point_ending: String,
    shot_context: String,
    notes: String,
    tags: Vec<String>,
    events: Vec<ClipEvent>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CandidateClipInput {
    candidate_id: Option<String>,
    session_id: Option<String>,
    local_video_id: String,
    start_ms: u64,
    end_ms: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DetectionInput {
    local_video_id: String,
    session_id: Option<String>,
    mode: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DetectorBenchmark {
    mode: String,
    label: String,
    available: bool,
    candidate_count: usize,
    elapsed_ms: u128,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReelExportInput {
    clip_id: String,
    keyframes: Vec<ReelKeyframeInput>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ReelKeyframeInput {
    timestamp_ms: u64,
    x_percent: f64,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct ReelWorkerOutput {
    output: String,
}

#[derive(Debug, Deserialize)]
struct WorkerAnalysis {
    ranges: Vec<WorkerRange>,
}

#[derive(Debug, Deserialize)]
struct WorkerRange {
    start_ms: u64,
    end_ms: u64,
    #[allow(dead_code)]
    confidence: Option<f64>,
    #[allow(dead_code)]
    source: Option<String>,
}

struct ActivityRange {
    start_ms: u64,
    end_ms: u64,
}

#[derive(Debug, Clone)]
struct DetectionRange {
    start_ms: u64,
    end_ms: u64,
    source: String,
    confidence: Option<f64>,
}

struct VideoInfo {
    width: u32,
    height: u32,
    duration_ms: u64,
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn now_string() -> String {
    now_ms().to_string()
}

fn id(prefix: &str) -> String {
    format!("{}-{}", prefix, now_ms())
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve app data directory: {error}"))?;
    fs::create_dir_all(&dir)
        .map_err(|error| format!("Could not create app data directory: {error}"))?;
    Ok(dir)
}

fn library_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("library.json"))
}

fn clips_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_data_dir(app)?.join("clips");
    fs::create_dir_all(&dir)
        .map_err(|error| format!("Could not create clips directory: {error}"))?;
    Ok(dir)
}

fn project_clips_dir(
    app: &AppHandle,
    library: &LibraryState,
    clip: &Clip,
) -> Result<PathBuf, String> {
    let project_name = clip
        .session_id
        .as_deref()
        .and_then(|session_id| {
            library
                .sessions
                .iter()
                .find(|session| session.id == session_id)
        })
        .map(|session| session.title.as_str())
        .unwrap_or("Unassigned Project");
    let dir = clips_dir(app)?.join(safe_file_stem(project_name));
    fs::create_dir_all(&dir)
        .map_err(|error| format!("Could not create project clips directory: {error}"))?;
    Ok(dir)
}

fn project_reels_dir(
    app: &AppHandle,
    library: &LibraryState,
    clip: &Clip,
) -> Result<PathBuf, String> {
    let project_name = clip
        .session_id
        .as_deref()
        .and_then(|session_id| {
            library
                .sessions
                .iter()
                .find(|session| session.id == session_id)
        })
        .map(|session| session.title.as_str())
        .unwrap_or("Unassigned Project");
    let dir = app_data_dir(app)?
        .join("reels")
        .join(safe_file_stem(project_name));
    fs::create_dir_all(&dir)
        .map_err(|error| format!("Could not create project reels directory: {error}"))?;
    Ok(dir)
}

fn previews_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_data_dir(app)?.join("previews");
    fs::create_dir_all(&dir)
        .map_err(|error| format!("Could not create previews directory: {error}"))?;
    Ok(dir)
}

fn read_library(app: &AppHandle) -> Result<LibraryState, String> {
    let path = library_path(app)?;
    if !path.exists() {
        return Ok(LibraryState::default());
    }

    let content = fs::read_to_string(path)
        .map_err(|error| format!("Could not read local library: {error}"))?;
    serde_json::from_str(&content)
        .map_err(|error| format!("Could not parse local library: {error}"))
}

fn write_library(app: &AppHandle, library: &LibraryState) -> Result<(), String> {
    let path = library_path(app)?;
    let content = serde_json::to_string_pretty(library)
        .map_err(|error| format!("Could not serialize local library: {error}"))?;
    fs::write(path, content).map_err(|error| format!("Could not save local library: {error}"))
}

fn safe_file_stem(value: &str) -> String {
    let stem = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();

    if stem.is_empty() {
        "raqet-clip".to_string()
    } else {
        stem
    }
}

fn format_ms(ms: u64) -> String {
    let total_seconds = ms / 1000;
    let minutes = total_seconds / 60;
    let seconds = total_seconds % 60;
    format!("{minutes}:{seconds:02}")
}

fn count_result(clips: &[Clip], result: &str) -> usize {
    clips
        .iter()
        .filter(|clip| clip.point_result == result)
        .count()
}

fn is_error_ending(ending: &str) -> bool {
    ending.contains("error")
        || ending == "double_fault"
        || ending.starts_with("double_fault_")
        || ending == "missed_return"
}

fn is_winner_ending(ending: &str) -> bool {
    ending == "ace" || ending == "winner" || ending.ends_with("_winner")
}

fn project_report_markdown(library: &LibraryState, session: &Session) -> String {
    let videos: Vec<&LocalVideo> = library
        .videos
        .iter()
        .filter(|video| video.session_id.as_deref() == Some(session.id.as_str()))
        .collect();
    let clips: Vec<&Clip> = library
        .clips
        .iter()
        .filter(|clip| clip.session_id.as_deref() == Some(session.id.as_str()))
        .collect();
    let won = count_result(
        &clips.iter().map(|clip| (*clip).clone()).collect::<Vec<_>>(),
        "won",
    );
    let lost = count_result(
        &clips.iter().map(|clip| (*clip).clone()).collect::<Vec<_>>(),
        "lost",
    );
    let winners = clips
        .iter()
        .filter(|clip| is_winner_ending(&clip.point_ending))
        .count();
    let errors = clips
        .iter()
        .filter(|clip| is_error_ending(&clip.point_ending))
        .count();
    let win_rate = if won + lost == 0 {
        "0%".to_string()
    } else {
        format!("{}%", ((won as f64 / (won + lost) as f64) * 100.0).round())
    };

    let mut markdown = String::new();
    markdown.push_str(&format!("# {}\n\n", session.title));
    if !session.notes.trim().is_empty() {
        markdown.push_str(&format!("{}\n\n", session.notes.trim()));
    }

    markdown.push_str("## Summary\n\n");
    markdown.push_str(&format!("- Clips: {}\n", clips.len()));
    markdown.push_str(&format!("- Videos: {}\n", videos.len()));
    markdown.push_str(&format!("- Record: {}-{}\n", won, lost));
    markdown.push_str(&format!("- Win rate: {}\n", win_rate));
    markdown.push_str(&format!("- Winners and aces: {}\n", winners));
    markdown.push_str(&format!("- Errors: {}\n\n", errors));

    markdown.push_str("## Videos\n\n");
    if videos.is_empty() {
        markdown.push_str("No videos assigned to this project.\n\n");
    } else {
        for video in &videos {
            markdown.push_str(&format!(
                "- {}  \n  `{}`\n",
                video.file_name, video.file_path
            ));
        }
        markdown.push('\n');
    }

    markdown.push_str("## Clips\n\n");
    if clips.is_empty() {
        markdown.push_str("No clips saved for this project.\n");
        return markdown;
    }

    for clip in clips {
        markdown.push_str(&format!("### {}\n\n", clip.title));
        markdown.push_str(&format!(
            "- Time: {} - {}\n",
            format_ms(clip.start_ms),
            format_ms(clip.end_ms)
        ));
        markdown.push_str(&format!("- Result: {}\n", clip.point_result));
        markdown.push_str(&format!("- Ending: {}\n", clip.point_ending));
        markdown.push_str(&format!("- Context: {}\n", clip.shot_context));
        if !clip.tags.is_empty() {
            markdown.push_str(&format!("- Tags: {}\n", clip.tags.join(", ")));
        }
        if let Some(path) = &clip.exported_clip_path {
            markdown.push_str(&format!("- Exported clip: `{}`\n", path));
        }
        if !clip.notes.trim().is_empty() {
            markdown.push_str(&format!("\nNotes: {}\n", clip.notes.trim()));
        }
        if !clip.events.is_empty() {
            markdown.push_str("\nTimeline:\n");
            for event in &clip.events {
                markdown.push_str(&format!(
                    "- {}: {}{}\n",
                    format_ms(event.timestamp_ms),
                    event.action,
                    if event.note.trim().is_empty() {
                        "".to_string()
                    } else {
                        format!(" - {}", event.note.trim())
                    }
                ));
            }
        }
        markdown.push('\n');
    }

    markdown
}

fn ensure_mp4_extension(mut path: PathBuf) -> PathBuf {
    if path.extension().and_then(|extension| extension.to_str()) != Some("mp4") {
        path.set_extension("mp4");
    }
    path
}

fn seconds(ms: u64) -> String {
    format!("{:.3}", ms as f64 / 1000.0)
}

fn probe_duration_ms(path: &str) -> Result<u64, String> {
    let output = Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            path,
        ])
        .output()
        .map_err(|_| {
            "ffprobe was not found. Install ffmpeg and make sure ffprobe is available on PATH."
                .to_string()
        })?;

    if !output.status.success() {
        return Err("ffprobe could not read the video duration.".to_string());
    }

    let value = String::from_utf8_lossy(&output.stdout);
    let seconds = value
        .trim()
        .parse::<f64>()
        .map_err(|_| "ffprobe returned an unreadable video duration.".to_string())?;
    Ok((seconds * 1000.0).round() as u64)
}

fn probe_video_info(path: &str) -> Result<VideoInfo, String> {
    let output = Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1",
            path,
        ])
        .output()
        .map_err(|_| {
            "ffprobe was not found. Install ffmpeg and make sure ffprobe is available on PATH."
                .to_string()
        })?;

    if !output.status.success() {
        return Err("ffprobe could not read the video metadata.".to_string());
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let mut width = None;
    let mut height = None;
    let mut duration = None;
    for line in text.lines() {
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        match key {
            "width" => width = value.parse::<u32>().ok(),
            "height" => height = value.parse::<u32>().ok(),
            "duration" => duration = value.parse::<f64>().ok(),
            _ => {}
        }
    }

    Ok(VideoInfo {
        width: width.ok_or_else(|| "ffprobe did not return a video width.".to_string())?,
        height: height.ok_or_else(|| "ffprobe did not return a video height.".to_string())?,
        duration_ms: (duration
            .ok_or_else(|| "ffprobe did not return a video duration.".to_string())?
            * 1000.0)
            .round() as u64,
    })
}

fn detect_silence_markers_ms(path: &str, noise: &str, duration: &str) -> Result<Vec<u64>, String> {
    let filter = format!("silencedetect=noise={noise}:d={duration}");
    let output = Command::new("ffmpeg")
        .args(["-i", path, "-af", &filter, "-f", "null", "-"])
        .stdout(Stdio::null())
        .output()
        .map_err(|_| {
            "ffmpeg was not found. Install ffmpeg and make sure it is available on PATH."
                .to_string()
        })?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    let mut markers = Vec::new();
    for line in stderr.lines() {
        let Some(index) = line.find("silence_end:") else {
            continue;
        };
        let rest = &line[index + "silence_end:".len()..];
        let Some(value) = rest.split_whitespace().next() else {
            continue;
        };
        if let Ok(seconds) = value.parse::<f64>() {
            markers.push((seconds * 1000.0).round() as u64);
        }
    }

    Ok(markers)
}

fn detect_scene_markers_ms(path: &str, threshold: f32) -> Result<Vec<u64>, String> {
    let filter = format!("select=gt(scene\\,{threshold}),showinfo");
    let output = Command::new("ffmpeg")
        .args([
            "-hide_banner",
            "-i",
            path,
            "-vf",
            &filter,
            "-an",
            "-f",
            "null",
            "-",
        ])
        .stdout(Stdio::null())
        .output()
        .map_err(|_| {
            "ffmpeg was not found. Install ffmpeg and make sure it is available on PATH."
                .to_string()
        })?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    let mut markers = Vec::new();
    for line in stderr.lines() {
        let Some(index) = line.find("pts_time:") else {
            continue;
        };
        let rest = &line[index + "pts_time:".len()..];
        let Some(value) = rest.split_whitespace().next() else {
            continue;
        };
        if let Ok(seconds) = value.parse::<f64>() {
            markers.push((seconds * 1000.0).round() as u64);
        }
    }

    Ok(markers)
}

fn merge_markers(duration_ms: u64, marker_sets: &[Vec<u64>], minimum_gap_ms: u64) -> Vec<u64> {
    let merged = marker_sets
        .iter()
        .flat_map(|markers| markers.iter().copied())
        .collect::<Vec<_>>();
    clean_markers(duration_ms, &merged, minimum_gap_ms)
}

fn clean_markers(duration_ms: u64, markers: &[u64], minimum_gap_ms: u64) -> Vec<u64> {
    let mut cleaned: Vec<u64> = markers
        .iter()
        .copied()
        .filter(|marker| {
            *marker > minimum_gap_ms && *marker < duration_ms.saturating_sub(minimum_gap_ms)
        })
        .collect();
    cleaned.sort_unstable();
    cleaned.dedup();

    let mut spaced = Vec::new();
    for marker in cleaned {
        if spaced
            .last()
            .map_or(true, |previous| marker >= previous + minimum_gap_ms)
        {
            spaced.push(marker);
        }
    }
    spaced
}

fn candidate_ranges_from_boundaries(duration_ms: u64, boundaries: &[u64]) -> Vec<(u64, u64)> {
    let minimum_point_ms = 3_000;
    let maximum_point_ms = 90_000;
    let preroll_ms = 800;
    let postroll_ms = 800;
    let mut starts = vec![0];

    starts.extend(clean_markers(duration_ms, boundaries, 2_500));
    starts.push(duration_ms);
    starts.sort_unstable();
    starts.dedup();

    let mut ranges = Vec::new();
    for window in starts.windows(2) {
        let start = window[0].saturating_sub(preroll_ms);
        let end = (window[1] + postroll_ms).min(duration_ms);
        let length = end.saturating_sub(start);
        if length >= minimum_point_ms && length <= maximum_point_ms {
            ranges.push((start, end));
        }
    }

    ranges
}

fn candidate_ranges_from_silence(duration_ms: u64, markers: &[u64]) -> Vec<(u64, u64)> {
    let minimum_point_ms = 4_000;
    let maximum_point_ms = 45_000;
    let preroll_ms = 1_500;
    let postroll_ms = 2_000;
    let mut starts = vec![0];

    starts.extend(clean_markers(duration_ms, markers, 2_000));
    starts.sort_unstable();
    starts.dedup();

    let mut ranges = Vec::new();
    for window in starts.windows(2) {
        let start = window[0].saturating_sub(preroll_ms);
        let end = (window[1] + postroll_ms).min(duration_ms);
        let length = end.saturating_sub(start);
        if length >= minimum_point_ms && length <= maximum_point_ms {
            ranges.push((start, end));
        }
    }

    if let Some(last_start) = starts.last().copied() {
        let start = last_start.saturating_sub(preroll_ms);
        let end = duration_ms;
        let length = end.saturating_sub(start);
        if length >= minimum_point_ms && length <= maximum_point_ms {
            ranges.push((start, end));
        }
    }

    ranges
}

fn detection_ranges(source: &str, ranges: Vec<(u64, u64)>) -> Vec<DetectionRange> {
    ranges
        .into_iter()
        .map(|(start_ms, end_ms)| DetectionRange {
            start_ms,
            end_ms,
            source: source.to_string(),
            confidence: None,
        })
        .collect()
}

fn percentile(values: &[f64], percentile_value: f64) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    let mut ordered = values.to_vec();
    ordered.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let index = (ordered.len().saturating_sub(1)) as f64 * percentile_value;
    let lower = index.floor() as usize;
    let upper = index.ceil() as usize;
    if lower == upper {
        ordered[lower]
    } else {
        ordered[lower] * (upper as f64 - index) + ordered[upper] * (index - lower as f64)
    }
}

fn frame_motion_scores(path: &str) -> Result<Vec<(u64, f64)>, String> {
    const FRAME_WIDTH: usize = 160;
    const FRAME_HEIGHT: usize = 90;
    const FRAME_RATE: u64 = 2;
    const FRAME_BYTES: usize = FRAME_WIDTH * FRAME_HEIGHT;

    let output = Command::new("ffmpeg")
        .args([
            "-hide_banner",
            "-i",
            path,
            "-vf",
            "fps=2,scale=160:90,format=gray",
            "-an",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "gray",
            "-",
        ])
        .stderr(Stdio::null())
        .output()
        .map_err(|_| {
            "ffmpeg was not found. Install ffmpeg and make sure it is available on PATH."
                .to_string()
        })?;

    if !output.status.success() {
        return Err("ffmpeg could not read video frames for auto clipping.".to_string());
    }

    let mut scores = Vec::new();
    let mut previous: Option<&[u8]> = None;
    for (index, frame) in output.stdout.chunks_exact(FRAME_BYTES).enumerate() {
        let timestamp_ms = ((index as u64) * 1000) / FRAME_RATE;
        let score = previous.map_or(0.0, |last_frame| {
            frame
                .iter()
                .zip(last_frame.iter())
                .map(|(current, previous)| (*current as i16 - *previous as i16).abs() as u64)
                .sum::<u64>() as f64
                / (FRAME_BYTES as f64 * 255.0)
        });
        scores.push((timestamp_ms, score));
        previous = Some(frame);
    }
    Ok(scores)
}

fn audio_energy_scores(path: &str, duration_ms: u64) -> Result<Vec<(u64, f64)>, String> {
    let output = Command::new("ffmpeg")
        .args([
            "-hide_banner",
            "-i",
            path,
            "-vn",
            "-ac",
            "1",
            "-ar",
            "100",
            "-f",
            "s16le",
            "-",
        ])
        .stderr(Stdio::null())
        .output()
        .map_err(|_| {
            "ffmpeg was not found. Install ffmpeg and make sure it is available on PATH."
                .to_string()
        })?;

    if !output.status.success() {
        return Err("ffmpeg could not read audio for auto clipping.".to_string());
    }

    let samples = output
        .stdout
        .chunks_exact(2)
        .map(|chunk| i16::from_le_bytes([chunk[0], chunk[1]]))
        .collect::<Vec<_>>();

    let sample_rate = 100_u64;
    let samples_per_bucket = 50_usize;
    let mut scores = Vec::new();
    for (bucket_index, bucket) in samples.chunks(samples_per_bucket).enumerate() {
        if bucket.is_empty() {
            continue;
        }
        let rms = (bucket
            .iter()
            .map(|sample| (*sample as f64) * (*sample as f64))
            .sum::<f64>()
            / bucket.len() as f64)
            .sqrt()
            / 32768.0;
        let timestamp_ms = ((bucket_index * samples_per_bucket) as u64 * 1000) / sample_rate;
        if timestamp_ms <= duration_ms {
            scores.push((timestamp_ms, rms));
        }
    }
    Ok(scores)
}

fn normalize_scores(scores: &[(u64, f64)]) -> Vec<(u64, f64)> {
    let values = scores.iter().map(|(_, score)| *score).collect::<Vec<_>>();
    let low = percentile(&values, 0.15);
    let high = percentile(&values, 0.92);
    let span = (high - low).max(0.000001);
    scores
        .iter()
        .map(|(timestamp_ms, score)| (*timestamp_ms, ((*score - low) / span).clamp(0.0, 1.0)))
        .collect()
}

fn score_at(scores: &[(u64, f64)], timestamp_ms: u64) -> f64 {
    if scores.is_empty() {
        return 0.0;
    }
    let index = ((timestamp_ms as f64 / 500.0).round() as usize).min(scores.len() - 1);
    scores[index].1
}

fn smooth_activity(active: &[bool], fill_gap_steps: usize, min_run_steps: usize) -> Vec<bool> {
    let mut smoothed = active.to_vec();
    let mut index = 0;
    while index < smoothed.len() {
        if smoothed[index] {
            index += 1;
            continue;
        }
        let start = index;
        while index < smoothed.len() && !smoothed[index] {
            index += 1;
        }
        if start > 0 && index < smoothed.len() && index - start <= fill_gap_steps {
            for item in smoothed.iter_mut().take(index).skip(start) {
                *item = true;
            }
        }
    }

    index = 0;
    while index < smoothed.len() {
        if !smoothed[index] {
            index += 1;
            continue;
        }
        let start = index;
        while index < smoothed.len() && smoothed[index] {
            index += 1;
        }
        if index - start < min_run_steps {
            for item in smoothed.iter_mut().take(index).skip(start) {
                *item = false;
            }
        }
    }
    smoothed
}

fn activity_ranges(
    motion_scores: &[(u64, f64)],
    audio_scores: &[(u64, f64)],
    duration_ms: u64,
) -> Vec<ActivityRange> {
    let motion = normalize_scores(motion_scores);
    let audio = normalize_scores(audio_scores);
    let step_ms = 500;
    let mut combined = Vec::new();
    let mut timestamp_ms = 0;
    while timestamp_ms <= duration_ms + step_ms {
        let score = score_at(&motion, timestamp_ms) * 0.78 + score_at(&audio, timestamp_ms) * 0.22;
        combined.push((timestamp_ms, score));
        timestamp_ms += step_ms;
    }

    let values = combined.iter().map(|(_, score)| *score).collect::<Vec<_>>();
    let threshold = percentile(&values, 0.56).max(0.30);
    let active = combined
        .iter()
        .map(|(_, score)| *score >= threshold)
        .collect::<Vec<_>>();
    let active = smooth_activity(&active, 8, 5);

    let mut ranges = Vec::new();
    let mut index = 0;
    while index < active.len() {
        if !active[index] {
            index += 1;
            continue;
        }
        let start_index = index;
        while index < active.len() && active[index] {
            index += 1;
        }
        let end_index = index.saturating_sub(1);
        let start_ms = combined[start_index].0.saturating_sub(1500);
        let end_ms = (combined[end_index].0 + 2500).min(duration_ms);
        let length = end_ms.saturating_sub(start_ms);
        if (3_500..=90_000).contains(&length) {
            ranges.push(ActivityRange { start_ms, end_ms });
        }
    }
    ranges
}

fn scene_motion_boundaries(motion_scores: &[(u64, f64)], duration_ms: u64) -> Vec<u64> {
    let values = motion_scores
        .iter()
        .map(|(_, score)| *score)
        .collect::<Vec<_>>();
    if values.len() < 4 {
        return Vec::new();
    }
    let p90 = percentile(&values, 0.90);
    let p97 = percentile(&values, 0.97);
    let threshold = p97.max(p90 * 1.8).max(0.12);
    let mut boundaries = Vec::new();
    for (timestamp_ms, score) in motion_scores {
        if *score >= threshold
            && *timestamp_ms > 2_500
            && *timestamp_ms < duration_ms.saturating_sub(2_500)
        {
            if boundaries
                .last()
                .map_or(true, |previous| timestamp_ms >= &(previous + 2_500))
            {
                boundaries.push(*timestamp_ms);
            }
        }
    }
    boundaries
}

fn analyze_video_activity(video_path: &str) -> Result<Vec<DetectionRange>, String> {
    let duration_ms = probe_duration_ms(video_path)?;
    let motion_scores = frame_motion_scores(video_path)?;
    let audio_scores = audio_energy_scores(video_path, duration_ms)?;
    let ranges = activity_ranges(&motion_scores, &audio_scores, duration_ms)
        .into_iter()
        .map(|range| DetectionRange {
            start_ms: range.start_ms,
            end_ms: range.end_ms,
            source: "activity".to_string(),
            confidence: None,
        })
        .collect::<Vec<_>>();

    if ranges.is_empty() {
        Err("Activity detection found no useful candidate ranges.".to_string())
    } else {
        Ok(ranges)
    }
}

fn analyze_video_scene(video_path: &str) -> Result<Vec<DetectionRange>, String> {
    let duration_ms = probe_duration_ms(video_path)?;
    let motion_scores = frame_motion_scores(video_path)?;
    let mut boundaries = scene_motion_boundaries(&motion_scores, duration_ms);
    if boundaries.len() < 2 {
        boundaries = merge_markers(
            duration_ms,
            &[
                detect_scene_markers_ms(video_path, 0.26)?,
                detect_scene_markers_ms(video_path, 0.18)?,
                detect_scene_markers_ms(video_path, 0.10)?,
            ],
            2_500,
        );
    }
    let ranges = candidate_ranges_from_boundaries(duration_ms, &boundaries);
    if ranges.is_empty() {
        Err("Scene-cut detection found no useful candidate ranges.".to_string())
    } else {
        Ok(detection_ranges("scene", ranges))
    }
}

fn analyze_video_audio(video_path: &str) -> Result<Vec<DetectionRange>, String> {
    let duration_ms = probe_duration_ms(video_path)?;
    let markers = merge_markers(
        duration_ms,
        &[
            detect_silence_markers_ms(video_path, "-35dB", "1.0")?,
            detect_silence_markers_ms(video_path, "-30dB", "0.7")?,
            detect_silence_markers_ms(video_path, "-25dB", "0.45")?,
        ],
        2_000,
    );
    let ranges = candidate_ranges_from_silence(duration_ms, &markers);
    if ranges.is_empty() {
        Err("Audio-pause detection found no useful candidate ranges.".to_string())
    } else {
        Ok(detection_ranges("audio", ranges))
    }
}

fn find_worker_script(file_name: &str) -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(current_dir) = std::env::current_dir() {
        for ancestor in current_dir.ancestors() {
            candidates.push(ancestor.join("analysis_worker").join(file_name));
            candidates.push(
                ancestor
                    .join("apps")
                    .join("desktop")
                    .join("analysis_worker")
                    .join(file_name),
            );
        }
    }
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            for ancestor in exe_dir.ancestors() {
                candidates.push(ancestor.join("analysis_worker").join(file_name));
                candidates.push(
                    ancestor
                        .join("apps")
                        .join("desktop")
                        .join("analysis_worker")
                        .join(file_name),
                );
            }
        }
    }

    candidates.into_iter().find(|path| path.exists())
}

fn find_analysis_worker() -> Option<PathBuf> {
    find_worker_script("autoclip.py")
}

fn run_python_worker(
    command: &str,
    args: &[&str],
    script: &Path,
    video_path: &str,
) -> Result<WorkerAnalysis, String> {
    let output = Command::new(command)
        .args(args)
        .arg(script)
        .arg(video_path)
        .output()
        .map_err(|error| format!("{command} could not start: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "{command} auto-clip worker failed: {}",
            stderr.trim()
        ));
    }

    serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Auto-clip worker returned invalid JSON: {error}"))
}

fn analyze_video_with_worker(video_path: &str) -> Result<Vec<DetectionRange>, String> {
    let script = find_analysis_worker().ok_or_else(|| {
        "Auto-clip worker was not found in apps/desktop/analysis_worker.".to_string()
    })?;
    let analysis = run_python_worker("python", &[], &script, video_path)
        .or_else(|_| run_python_worker("py", &["-3"], &script, video_path))?;

    let ranges = analysis
        .ranges
        .into_iter()
        .filter(|range| range.end_ms > range.start_ms)
        .map(|range| DetectionRange {
            start_ms: range.start_ms,
            end_ms: range.end_ms,
            source: range.source.unwrap_or_else(|| "python-worker".to_string()),
            confidence: range.confidence,
        })
        .collect::<Vec<_>>();

    if ranges.is_empty() {
        Err("Auto-clip worker completed but found no candidate point ranges.".to_string())
    } else {
        Ok(ranges)
    }
}

fn parse_scene_timestamp_ms(value: &str) -> Option<u64> {
    let clean = value.trim();
    if clean.contains(':') {
        let parts = clean.split(':').collect::<Vec<_>>();
        if parts.len() != 3 {
            return None;
        }
        let hours = parts[0].parse::<f64>().ok()?;
        let minutes = parts[1].parse::<f64>().ok()?;
        let seconds = parts[2].parse::<f64>().ok()?;
        return Some(((hours * 3600.0 + minutes * 60.0 + seconds) * 1000.0).round() as u64);
    }

    clean
        .parse::<f64>()
        .ok()
        .map(|seconds| (seconds * 1000.0).round() as u64)
}

fn parse_scene_csv(content: &str) -> Vec<(u64, u64)> {
    let mut ranges = Vec::new();
    for line in content.lines().skip(1) {
        let columns = line
            .split(',')
            .map(|column| column.trim().trim_matches('"'))
            .collect::<Vec<_>>();
        if columns.len() < 7 || !columns[0].parse::<usize>().is_ok() {
            continue;
        }
        let Some(start_ms) = columns
            .get(2)
            .and_then(|value| parse_scene_timestamp_ms(value))
            .or_else(|| {
                columns
                    .get(3)
                    .and_then(|value| parse_scene_timestamp_ms(value))
            })
        else {
            continue;
        };
        let Some(end_ms) = columns
            .get(5)
            .and_then(|value| parse_scene_timestamp_ms(value))
            .or_else(|| {
                columns
                    .get(6)
                    .and_then(|value| parse_scene_timestamp_ms(value))
            })
        else {
            continue;
        };
        if end_ms > start_ms {
            ranges.push((start_ms, end_ms));
        }
    }
    ranges
}

fn analyze_video_with_pyscenedetect(video_path: &str) -> Result<Vec<DetectionRange>, String> {
    let output_dir = std::env::temp_dir().join(format!("raqet-scenedetect-{}", now_ms()));
    fs::create_dir_all(&output_dir)
        .map_err(|error| format!("Could not create PySceneDetect output directory: {error}"))?;

    let output = Command::new("scenedetect")
        .args([
            "--input",
            video_path,
            "--output",
            output_dir.to_string_lossy().as_ref(),
            "detect-adaptive",
            "list-scenes",
        ])
        .output()
        .map_err(|_| "PySceneDetect is not installed. Install it with `pip install scenedetect[opencv]` if you want to benchmark this detector.".to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("PySceneDetect failed: {}", stderr.trim()));
    }

    let mut ranges = Vec::new();
    for entry in fs::read_dir(&output_dir)
        .map_err(|error| format!("Could not read PySceneDetect output: {error}"))?
    {
        let path = entry
            .map_err(|error| format!("Could not inspect PySceneDetect output: {error}"))?
            .path();
        if path
            .extension()
            .and_then(|extension| extension.to_str())
            .map_or(false, |extension| extension.eq_ignore_ascii_case("csv"))
        {
            let content = fs::read_to_string(&path)
                .map_err(|error| format!("Could not read PySceneDetect scene list: {error}"))?;
            ranges.extend(parse_scene_csv(&content));
        }
    }

    if ranges.is_empty() {
        Err("PySceneDetect ran but found no scene ranges.".to_string())
    } else {
        Ok(detection_ranges("pyscenedetect", ranges))
    }
}

fn analyze_video_auto(video_path: &str) -> Result<Vec<DetectionRange>, String> {
    analyze_video_activity(video_path)
        .or_else(|activity_error| {
            analyze_video_with_worker(video_path)
                .map_err(|worker_error| format!("{activity_error}. {worker_error}"))
        })
        .or_else(|analysis_error| {
            analyze_video_scene(video_path)
                .or_else(|scene_error| analyze_video_audio(video_path).map_err(|audio_error| format!("{scene_error}. {audio_error}")))
                .map_err(|fallback_error| {
                    format!(
                        "{analysis_error}. Fallback detection also found no reliable cuts: {fallback_error}. Mark the first point manually, or use a video with clearer breaks between points."
                    )
                })
        })
}

fn analyze_video_by_mode(video_path: &str, mode: &str) -> Result<Vec<DetectionRange>, String> {
    match mode {
        "activity" => analyze_video_activity(video_path),
        "scene" => analyze_video_scene(video_path),
        "audio" => analyze_video_audio(video_path),
        "pyscenedetect" => analyze_video_with_pyscenedetect(video_path),
        _ => analyze_video_auto(video_path),
    }
}

#[allow(dead_code)]
fn run_reel_worker(
    command: &str,
    args: &[&str],
    script: &Path,
    source: &str,
    clip: &Clip,
    output: &Path,
) -> Result<ReelWorkerOutput, String> {
    let output = Command::new(command)
        .args(args)
        .arg(script)
        .arg("--source")
        .arg(source)
        .arg("--start-ms")
        .arg(clip.start_ms.to_string())
        .arg("--end-ms")
        .arg(clip.end_ms.to_string())
        .arg("--output")
        .arg(output)
        .output()
        .map_err(|error| format!("{command} could not start YOLO reel exporter: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "{command} YOLO reel exporter failed: {}",
            stderr.trim()
        ));
    }

    serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("YOLO reel exporter returned invalid JSON: {error}"))
}

#[allow(dead_code)]
fn export_yolo_reel(video: &LocalVideo, clip: &Clip, output: &Path) -> Result<String, String> {
    let script = find_worker_script("yolo_reel_export.py").ok_or_else(|| {
        "YOLO reel exporter was not found in apps/desktop/analysis_worker.".to_string()
    })?;
    let exported = run_reel_worker("python", &[], &script, &video.file_path, clip, output)
        .or_else(|python_error| {
            run_reel_worker("py", &["-3"], &script, &video.file_path, clip, output)
                .map_err(|py_error| format!("{python_error}\n{py_error}"))
        })
        .or_else(|python_error| {
            run_reel_worker("python3", &[], &script, &video.file_path, clip, output)
                .map_err(|python3_error| format!("{python_error}\n{python3_error}"))
        })?;
    Ok(exported.output)
}

fn blur_values(values: &[f64], radius: usize) -> Vec<f64> {
    (0..values.len())
        .map(|index| {
            let start = index.saturating_sub(radius);
            let end = (index + radius + 1).min(values.len());
            values[start..end].iter().sum::<f64>() / (end - start).max(1) as f64
        })
        .collect()
}

fn reel_motion_centers(
    path: &str,
    clip: &Clip,
    info: &VideoInfo,
    analysis_width: usize,
    analysis_height: usize,
    fps: u64,
) -> Result<Vec<(f64, f64)>, String> {
    let frame_bytes = analysis_width * analysis_height;
    let duration_ms = clip
        .end_ms
        .saturating_sub(clip.start_ms)
        .min(info.duration_ms.saturating_sub(clip.start_ms));
    let output = Command::new("ffmpeg")
        .args([
            "-hide_banner",
            "-ss",
            &seconds(clip.start_ms),
            "-i",
            path,
            "-t",
            &seconds(duration_ms),
            "-vf",
            &format!("fps={fps},scale={analysis_width}:{analysis_height},format=gray"),
            "-an",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "gray",
            "-",
        ])
        .stderr(Stdio::null())
        .output()
        .map_err(|_| {
            "ffmpeg was not found. Install ffmpeg and make sure it is available on PATH."
                .to_string()
        })?;

    if !output.status.success() {
        return Err("ffmpeg could not read frames for reel tracking.".to_string());
    }

    let y_start = (analysis_height as f64 * 0.45).round() as usize;
    let scale_x = info.width as f64 / analysis_width as f64;
    let mut previous: Option<&[u8]> = None;
    let mut previous_x = analysis_width as f64 / 2.0;
    let mut centers = Vec::new();

    for (index, frame) in output.stdout.chunks_exact(frame_bytes).enumerate() {
        let timestamp = index as f64 / fps as f64;
        let Some(last_frame) = previous else {
            centers.push((timestamp, info.width as f64 / 2.0));
            previous = Some(frame);
            continue;
        };

        let mut column_energy = vec![0.0; analysis_width];
        for y in y_start..analysis_height {
            let row_offset = y * analysis_width;
            let vertical_weight =
                1.0 + ((y - y_start) as f64 / (analysis_height - y_start).max(1) as f64) * 0.8;
            for x in 0..analysis_width {
                let diff =
                    (frame[row_offset + x] as i16 - last_frame[row_offset + x] as i16).abs() as f64;
                if diff > 8.0 {
                    column_energy[x] += diff * diff * vertical_weight;
                }
            }
        }

        if column_energy.iter().sum::<f64>() <= 0.0 {
            centers.push((
                timestamp,
                centers
                    .last()
                    .map_or(info.width as f64 / 2.0, |(_, center)| *center),
            ));
            previous = Some(frame);
            continue;
        }

        let column_energy = blur_values(&column_energy, 6);
        let peak = column_energy.iter().copied().fold(0.0, f64::max);
        let floor = percentile(&column_energy, 0.55);
        if peak < 1200.0_f64.max(floor * 1.35) {
            centers.push((
                timestamp,
                centers
                    .last()
                    .map_or(info.width as f64 / 2.0, |(_, center)| *center),
            ));
            previous = Some(frame);
            continue;
        }

        let mut best_x = previous_x;
        let mut best_score = f64::MIN;
        for (x, energy) in column_energy.iter().enumerate() {
            let x = x as f64;
            let distance_penalty = (x - previous_x).abs() * peak * 0.006;
            let center_bias = (x - analysis_width as f64 / 2.0).abs() * peak * 0.0008;
            let score = *energy - distance_penalty - center_bias;
            if score > best_score {
                best_score = score;
                best_x = x;
            }
        }

        previous_x = previous_x * 0.72 + best_x * 0.28;
        centers.push((timestamp, previous_x * scale_x));
        previous = Some(frame);
    }

    Ok(centers)
}

fn smooth_reel_crop_path(centers: &[(f64, f64)], info: &VideoInfo) -> (Vec<(f64, f64)>, u32) {
    let mut crop_width = info
        .width
        .min(((info.height as f64) * 9.0 / 16.0).round() as u32);
    if crop_width % 2 == 1 {
        crop_width = crop_width.saturating_sub(1);
    }
    let max_x = info.width.saturating_sub(crop_width) as f64;
    if centers.is_empty() {
        return (vec![(0.0, max_x / 2.0)], crop_width);
    }

    let targets = centers
        .iter()
        .map(|(timestamp, center)| {
            (
                *timestamp,
                (center - crop_width as f64 / 2.0).clamp(0.0, max_x),
            )
        })
        .collect::<Vec<_>>();

    let mut medianed = Vec::new();
    for index in 0..targets.len() {
        let start = index.saturating_sub(8);
        let end = (index + 13).min(targets.len());
        let positions = targets[start..end]
            .iter()
            .map(|(_, position)| *position)
            .collect::<Vec<_>>();
        medianed.push((targets[index].0, percentile(&positions, 0.5)));
    }

    let lookahead_frames = 10_usize;
    let lookahead = (0..medianed.len())
        .map(|index| {
            let end = (index + lookahead_frames + 1).min(medianed.len());
            let average = medianed[index..end]
                .iter()
                .map(|(_, position)| *position)
                .sum::<f64>()
                / (end - index).max(1) as f64;
            (medianed[index].0, average)
        })
        .collect::<Vec<_>>();

    let mut current = lookahead[0].1;
    let mut velocity = 0.0;
    let mut last_timestamp = lookahead[0].0;
    let max_pan_per_second = 520.0_f64.max(crop_width as f64 * 1.35);
    let max_accel_per_second = 1100.0_f64.max(crop_width as f64 * 2.4);
    let mut smoothed = Vec::new();
    for (index, (timestamp, _)) in centers.iter().enumerate() {
        let target = lookahead[index.min(lookahead.len() - 1)].1;
        let elapsed = (*timestamp - last_timestamp).max(1.0 / 30.0);
        let distance = target - current;
        let desired_velocity =
            (distance / (elapsed * 8.0)).clamp(-max_pan_per_second, max_pan_per_second);
        let velocity_delta = (desired_velocity - velocity).clamp(
            -max_accel_per_second * elapsed,
            max_accel_per_second * elapsed,
        );
        velocity = (velocity + velocity_delta) * 0.90;
        if distance.abs() < crop_width as f64 * 0.012 && velocity.abs() < 35.0 {
            velocity *= 0.55;
        }
        current += velocity * elapsed;
        smoothed.push((*timestamp, current.clamp(0.0, max_x)));
        last_timestamp = *timestamp;
    }

    (smoothed, crop_width)
}

fn resample_reel_keyframes(path: &[(f64, f64)], duration_seconds: f64) -> Vec<(f64, i64)> {
    if path.is_empty() {
        return vec![(0.0, 0)];
    }
    let interval = (duration_seconds / 55.0).clamp(0.35, 0.70);
    let mut keyframes = Vec::new();
    let mut timestamp = 0.0;
    while timestamp < duration_seconds {
        let nearest = path
            .iter()
            .min_by(|(left_ts, _), (right_ts, _)| {
                (left_ts - timestamp)
                    .abs()
                    .partial_cmp(&(right_ts - timestamp).abs())
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .unwrap_or(&path[0]);
        keyframes.push((timestamp, nearest.1.round() as i64));
        timestamp += interval;
    }
    keyframes.push((
        duration_seconds,
        path.last()
            .map_or(0, |(_, position)| position.round() as i64),
    ));
    keyframes
}

fn smoothstep_expression(t0: f64, t1: f64) -> String {
    let span = (t1 - t0).max(0.001);
    let progress = format!("((t-{t0:.3})/{span:.3})");
    format!("({progress}*{progress}*(3-2*{progress}))")
}

fn ffmpeg_crop_expression(keyframes: &[(f64, i64)]) -> String {
    if keyframes.len() == 1 {
        return keyframes[0].1.to_string();
    }
    let mut expression = keyframes
        .last()
        .map_or("0".to_string(), |(_, x)| x.to_string());
    for index in (0..keyframes.len() - 1).rev() {
        let (t0, x0) = keyframes[index];
        let (t1, x1) = keyframes[index + 1];
        let easing = smoothstep_expression(t0, t1);
        let segment = format!("({x0}+({})*{easing})", x1 - x0);
        expression = format!("if(lt(t\\,{t1:.3})\\,{segment}\\,{expression})");
    }
    expression
}

fn even_ffmpeg_expression(expression: &str) -> String {
    format!("2*floor(({expression})/2)")
}

fn ffmpeg_error_tail(stderr: &[u8]) -> String {
    let text = String::from_utf8_lossy(stderr);
    let lines = text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .filter(|line| !line.starts_with("frame="))
        .collect::<Vec<_>>();
    let start = lines.len().saturating_sub(12);
    lines[start..].join("\n")
}

fn export_reel(
    video: &LocalVideo,
    clip: &Clip,
    output: &Path,
    manual_keyframes: &[ReelKeyframeInput],
) -> Result<String, String> {
    if manual_keyframes.len() < 2 {
        return Err("Add at least two reel keyframes before exporting: one near the start and one near the end.".to_string());
    }

    let duration_ms = clip.end_ms.saturating_sub(clip.start_ms);
    if duration_ms == 0 {
        return Err("Clip end must be after clip start.".to_string());
    }

    let info = probe_video_info(&video.file_path)?;
    let duration_ms = duration_ms.min(info.duration_ms.saturating_sub(clip.start_ms));
    let duration_seconds = duration_ms as f64 / 1000.0;
    if duration_seconds <= 0.0 {
        return Err("Clip duration is too short to export a reel.".to_string());
    }

    let crop_height = if info.height % 2 == 0 {
        info.height
    } else {
        info.height.saturating_sub(1)
    };
    let mut crop_width = info
        .width
        .min(((crop_height as f64) * 9.0 / 16.0).round() as u32);
    if crop_width % 2 == 1 {
        crop_width = crop_width.saturating_sub(1);
    }
    if crop_width == 0 || crop_height == 0 {
        return Err("Could not calculate a valid 9:16 crop for this video.".to_string());
    }

    let max_crop_x = info.width.saturating_sub(crop_width);
    let mut keyframes = manual_keyframes
        .iter()
        .map(|keyframe| {
            let timestamp = (keyframe.timestamp_ms.min(duration_ms) as f64 / 1000.0)
                .clamp(0.0, duration_seconds);
            let percent = keyframe.x_percent.clamp(0.0, 1.0);
            let mut x = (percent * max_crop_x as f64).round() as i64;
            x = (x / 2) * 2;
            (timestamp, x)
        })
        .collect::<Vec<_>>();

    keyframes.sort_by(|left, right| {
        left.0
            .partial_cmp(&right.0)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    keyframes.dedup_by(|left, right| (left.0 - right.0).abs() < 0.001);

    if keyframes.len() < 2 {
        return Err(
            "Reel keyframes are too close together. Add another keyframe later in the clip."
                .to_string(),
        );
    }

    let first_x = keyframes.first().map_or(0, |(_, x)| *x);
    if keyframes
        .first()
        .is_some_and(|(timestamp, _)| *timestamp > 0.001)
    {
        keyframes.insert(0, (0.0, first_x));
    }
    let last_x = keyframes.last().map_or(0, |(_, x)| *x);
    if keyframes
        .last()
        .is_some_and(|(timestamp, _)| *timestamp < duration_seconds - 0.001)
    {
        keyframes.push((duration_seconds, last_x));
    }

    let crop_x = format!(
        "min({max_crop_x}\\,max(0\\,{}))",
        even_ffmpeg_expression(&ffmpeg_crop_expression(&keyframes))
    );
    let filter_chain = format!(
        "crop={crop_width}:{crop_height}:{crop_x}:0,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1"
    );
    let status = Command::new("ffmpeg")
        .args([
            "-y",
            "-ss",
            &seconds(clip.start_ms),
            "-i",
            &video.file_path,
            "-t",
            &seconds(duration_ms),
            "-vf",
            &filter_chain,
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
            output.to_string_lossy().as_ref(),
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .output();

    match status {
        Ok(result) if result.status.success() => Ok(output.to_string_lossy().to_string()),
        Ok(result) => {
            let detail = ffmpeg_error_tail(&result.stderr);
            let detail = if detail.trim().is_empty() {
                "ffmpeg returned no error detail.".to_string()
            } else {
                detail
            };
            Err(format!(
                "ffmpeg could not export the keyframed reel: {detail}"
            ))
        }
        Err(_) => Err(
            "ffmpeg was not found. Install ffmpeg and make sure it is available on PATH."
                .to_string(),
        ),
    }
}

#[allow(dead_code)]
fn export_motion_reel(video: &LocalVideo, clip: &Clip, output: &Path) -> Result<String, String> {
    let duration_ms = clip.end_ms.saturating_sub(clip.start_ms);
    if duration_ms == 0 {
        return Err("Clip end must be after clip start.".to_string());
    }

    let info = probe_video_info(&video.file_path)?;
    let duration_ms = duration_ms.min(info.duration_ms.saturating_sub(clip.start_ms));
    let duration_seconds = duration_ms as f64 / 1000.0;
    let analysis_width = 320_usize;
    let mut analysis_height = ((info.height as f64 * (analysis_width as f64 / info.width as f64))
        .round() as usize)
        .max(90);
    if analysis_height % 2 == 1 {
        analysis_height += 1;
    }
    let centers = reel_motion_centers(
        &video.file_path,
        clip,
        &info,
        analysis_width,
        analysis_height,
        30,
    )?;
    let (crop_path, crop_width) = smooth_reel_crop_path(&centers, &info);
    let crop_height = if info.height % 2 == 0 {
        info.height
    } else {
        info.height.saturating_sub(1)
    };
    let max_crop_x = info.width.saturating_sub(crop_width);
    let keyframes = resample_reel_keyframes(&crop_path, duration_seconds);
    let crop_x = format!(
        "min({max_crop_x}\\,max(0\\,{}))",
        even_ffmpeg_expression(&ffmpeg_crop_expression(&keyframes))
    );
    let filter_chain = format!(
        "crop={crop_width}:{crop_height}:{crop_x}:0,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1"
    );
    let status = Command::new("ffmpeg")
        .args([
            "-y",
            "-ss",
            &seconds(clip.start_ms),
            "-i",
            &video.file_path,
            "-t",
            &seconds(duration_ms),
            "-vf",
            &filter_chain,
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
            output.to_string_lossy().as_ref(),
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .output();

    match status {
        Ok(result) if result.status.success() => Ok(output.to_string_lossy().to_string()),
        Ok(result) => {
            let detail = ffmpeg_error_tail(&result.stderr);
            let detail = if detail.trim().is_empty() {
                "ffmpeg returned no error detail.".to_string()
            } else {
                detail
            };
            Err(format!(
                "ffmpeg could not export the tracked reel: {detail}"
            ))
        }
        Err(_) => Err(
            "ffmpeg was not found. Install ffmpeg and make sure it is available on PATH."
                .to_string(),
        ),
    }
}

fn export_clip(video: &LocalVideo, clip: &Clip, output: &Path) -> Result<String, String> {
    let duration_ms = clip.end_ms.saturating_sub(clip.start_ms);
    if duration_ms == 0 {
        return Err("Clip end must be after clip start.".to_string());
    }

    let status = Command::new("ffmpeg")
        .args([
            "-y",
            "-ss",
            &seconds(clip.start_ms),
            "-i",
            &video.file_path,
            "-t",
            &seconds(duration_ms),
            "-c",
            "copy",
            output.to_string_lossy().as_ref(),
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();

    match status {
        Ok(result) if result.success() => Ok(output.to_string_lossy().to_string()),
        Ok(_) => Err("ffmpeg could not export the clip. Check that the source file is playable and try a different range.".to_string()),
        Err(_) => Err("ffmpeg was not found. Install ffmpeg and make sure it is available on PATH.".to_string()),
    }
}

fn create_preview_file(app: &AppHandle, video: &LocalVideo) -> Result<String, String> {
    let output = previews_dir(app)?.join(format!(
        "{}-{}.mp4",
        video.id,
        safe_file_stem(&video.file_name)
    ));

    let status = Command::new("ffmpeg")
        .args([
            "-y",
            "-i",
            &video.file_path,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            output.to_string_lossy().as_ref(),
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();

    match status {
        Ok(result) if result.success() => Ok(output.to_string_lossy().to_string()),
        Ok(_) => Err("ffmpeg could not create a compatible preview copy. Check that the source video is readable.".to_string()),
        Err(_) => Err("ffmpeg was not found. Install ffmpeg and make sure it is available on PATH.".to_string()),
    }
}

#[tauri::command]
fn load_library(app: AppHandle) -> Result<LibraryState, String> {
    read_library(&app)
}

#[tauri::command]
fn get_clips_folder(app: AppHandle) -> Result<String, String> {
    Ok(clips_dir(&app)?.to_string_lossy().to_string())
}

#[tauri::command]
fn open_clips_folder(app: AppHandle) -> Result<(), String> {
    let folder = clips_dir(&app)?;
    open_folder(&folder)
}

#[tauri::command]
fn open_export_folder(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    let folder = if path.is_dir() {
        path
    } else {
        path.parent()
            .ok_or_else(|| "Could not find the export folder.".to_string())?
            .to_path_buf()
    };
    open_folder(&folder)
}

fn open_folder(folder: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let status = Command::new("explorer").arg(folder).status();

    #[cfg(target_os = "macos")]
    let status = Command::new("open").arg(folder).status();

    #[cfg(target_os = "linux")]
    let status = Command::new("xdg-open").arg(folder).status();

    match status {
        Ok(result) if result.success() => Ok(()),
        Ok(_) => Err("Could not open the folder.".to_string()),
        Err(error) => Err(format!("Could not open the folder: {error}")),
    }
}

#[tauri::command]
fn open_data_folder(app: AppHandle) -> Result<(), String> {
    let folder = app_data_dir(&app)?;
    open_folder(&folder)
}

#[tauri::command]
fn export_library_backup(app: AppHandle) -> Result<Option<String>, String> {
    let library = read_library(&app)?;
    let Some(file_path) = app
        .dialog()
        .file()
        .add_filter("JSON", &["json"])
        .set_file_name("raqet-library-backup.json")
        .blocking_save_file()
    else {
        return Ok(None);
    };

    let path = file_path
        .as_path()
        .ok_or_else(|| "Could not read selected backup path.".to_string())?
        .to_path_buf();
    let content = serde_json::to_string_pretty(&library)
        .map_err(|error| format!("Could not serialize local library: {error}"))?;
    fs::write(&path, content)
        .map_err(|error| format!("Could not export local library: {error}"))?;
    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command]
fn import_library_backup(app: AppHandle) -> Result<Option<LibraryState>, String> {
    let Some(file_path) = app
        .dialog()
        .file()
        .add_filter("JSON", &["json"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };

    let path = file_path
        .as_path()
        .ok_or_else(|| "Could not read selected backup path.".to_string())?
        .to_path_buf();
    let content = fs::read_to_string(&path)
        .map_err(|error| format!("Could not read backup file: {error}"))?;
    let library: LibraryState = serde_json::from_str(&content)
        .map_err(|error| format!("Could not parse backup file: {error}"))?;
    write_library(&app, &library)?;
    Ok(Some(library))
}

#[tauri::command]
fn export_project_report(app: AppHandle, session_id: String) -> Result<Option<String>, String> {
    let library = read_library(&app)?;
    let session = library
        .sessions
        .iter()
        .find(|session| session.id == session_id)
        .ok_or_else(|| "Project was not found in the local library.".to_string())?;
    let default_file_name = format!("{}-report.md", safe_file_stem(&session.title));

    let Some(file_path) = app
        .dialog()
        .file()
        .add_filter("Markdown", &["md"])
        .set_file_name(&default_file_name)
        .blocking_save_file()
    else {
        return Ok(None);
    };

    let path = file_path
        .as_path()
        .ok_or_else(|| "Could not read selected report path.".to_string())?
        .to_path_buf();
    fs::write(&path, project_report_markdown(&library, session))
        .map_err(|error| format!("Could not export project report: {error}"))?;
    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command]
fn get_project_report_markdown(app: AppHandle, session_id: String) -> Result<String, String> {
    let library = read_library(&app)?;
    let session = library
        .sessions
        .iter()
        .find(|session| session.id == session_id)
        .ok_or_else(|| "Project was not found in the local library.".to_string())?;

    Ok(project_report_markdown(&library, session))
}

fn create_video_from_path(path: PathBuf) -> Result<LocalVideo, String> {
    let extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let allowed_extensions = ["mp4", "mov", "mpeg", "mpg", "webm"];
    if !allowed_extensions.contains(&extension.as_str()) {
        return Err("Drop an MP4, MOV, MPEG, MPG, or WebM video file.".to_string());
    }

    if !path.exists() || !path.is_file() {
        return Err("The dropped video file could not be found.".to_string());
    }

    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("video")
        .to_string();

    Ok(LocalVideo {
        id: id("video"),
        session_id: None,
        file_path: path.to_string_lossy().to_string(),
        preview_file_path: None,
        file_name,
        duration_ms: None,
        imported_at: now_string(),
    })
}

fn store_imported_video(app: &AppHandle, video: LocalVideo) -> Result<LocalVideo, String> {
    let mut library = read_library(app)?;
    library
        .videos
        .retain(|item| item.file_path != video.file_path);
    library.videos.insert(0, video.clone());
    write_library(app, &library)?;
    Ok(video)
}

#[tauri::command]
fn import_video(app: AppHandle) -> Result<Option<LocalVideo>, String> {
    let Some(file_path) = app
        .dialog()
        .file()
        .add_filter("Video", &["mp4", "mov", "mpeg", "mpg", "webm"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };

    let path = file_path
        .as_path()
        .ok_or_else(|| "Could not read selected file path.".to_string())?
        .to_path_buf();
    let video = store_imported_video(&app, create_video_from_path(path)?)?;

    Ok(Some(video))
}

#[tauri::command]
fn import_video_path(app: AppHandle, file_path: String) -> Result<LocalVideo, String> {
    store_imported_video(&app, create_video_from_path(PathBuf::from(file_path))?)
}

#[tauri::command]
fn create_session(app: AppHandle, input: CreateSessionInput) -> Result<Session, String> {
    let mut library = read_library(&app)?;
    let title = input.title.trim();
    if title.is_empty() {
        return Err("Session title is required.".to_string());
    }

    let session = Session {
        id: id("session"),
        title: title.to_string(),
        notes: input.notes,
        created_at: now_string(),
    };

    library.sessions.insert(0, session.clone());
    write_library(&app, &library)?;
    Ok(session)
}

#[tauri::command]
fn update_session(app: AppHandle, input: UpdateSessionInput) -> Result<Session, String> {
    let mut library = read_library(&app)?;
    let title = input.title.trim();
    if title.is_empty() {
        return Err("Session title is required.".to_string());
    }

    let session = library
        .sessions
        .iter_mut()
        .find(|session| session.id == input.session_id)
        .ok_or_else(|| "Session was not found in the local library.".to_string())?;

    session.title = title.to_string();
    session.notes = input.notes;

    let updated_session = session.clone();
    write_library(&app, &library)?;
    Ok(updated_session)
}

#[tauri::command]
fn delete_session(app: AppHandle, session_id: String) -> Result<(), String> {
    let mut library = read_library(&app)?;
    library.sessions.retain(|session| session.id != session_id);

    for video in &mut library.videos {
        if video.session_id.as_deref() == Some(&session_id) {
            video.session_id = None;
        }
    }

    for clip in &mut library.clips {
        if clip.session_id.as_deref() == Some(&session_id) {
            clip.session_id = None;
        }
    }

    write_library(&app, &library)
}

#[tauri::command]
fn assign_video_session(
    app: AppHandle,
    local_video_id: String,
    session_id: Option<String>,
) -> Result<LocalVideo, String> {
    let mut library = read_library(&app)?;
    let video = library
        .videos
        .iter_mut()
        .find(|item| item.id == local_video_id)
        .ok_or_else(|| "Video was not found in the local library.".to_string())?;

    video.session_id = session_id;
    let updated_video = video.clone();
    write_library(&app, &library)?;
    Ok(updated_video)
}

#[tauri::command]
fn create_compatible_preview(app: AppHandle, local_video_id: String) -> Result<LocalVideo, String> {
    let mut library = read_library(&app)?;
    let video = library
        .videos
        .iter_mut()
        .find(|item| item.id == local_video_id)
        .ok_or_else(|| "Video was not found in the local library.".to_string())?;

    if !Path::new(&video.file_path).exists() {
        return Err("The source video no longer exists at its original path.".to_string());
    }

    let preview_path = create_preview_file(&app, video)?;
    video.preview_file_path = Some(preview_path);

    let updated_video = video.clone();
    write_library(&app, &library)?;
    Ok(updated_video)
}

#[tauri::command]
fn detect_candidate_clips(
    app: AppHandle,
    input: DetectionInput,
) -> Result<Vec<CandidateClip>, String> {
    let mut library = read_library(&app)?;
    let video = library
        .videos
        .iter()
        .find(|item| item.id == input.local_video_id)
        .cloned()
        .ok_or_else(|| "Video was not found in the local library.".to_string())?;

    if !Path::new(&video.file_path).exists() {
        return Err("The source video no longer exists at its original path.".to_string());
    }

    let ranges = analyze_video_by_mode(&video.file_path, &input.mode)?;
    if ranges.is_empty() {
        return Err("No reliable candidate cuts found. I checked visual cuts and audio pauses, but this video does not expose clear break points. Mark the first point manually, or use a highlights file with stronger cuts between points.".to_string());
    }
    let resolved_session_id = input.session_id.or(video.session_id);

    library.candidate_clips.retain(|candidate| {
        !(candidate.local_video_id == input.local_video_id && candidate.status == "pending")
    });

    let created_at = now_string();
    let candidate_prefix = id("candidate");
    let candidates: Vec<CandidateClip> = ranges
        .into_iter()
        .take(80)
        .enumerate()
        .map(|(index, range)| CandidateClip {
            id: format!("{candidate_prefix}-{index}"),
            session_id: resolved_session_id.clone(),
            local_video_id: input.local_video_id.clone(),
            start_ms: range.start_ms,
            end_ms: range.end_ms,
            status: "pending".to_string(),
            source: Some(range.source),
            confidence: range.confidence,
            created_at: created_at.clone(),
        })
        .collect();

    library.candidate_clips.extend(candidates.clone());
    write_library(&app, &library)?;
    Ok(candidates)
}

#[tauri::command]
fn benchmark_detectors(
    app: AppHandle,
    local_video_id: String,
) -> Result<Vec<DetectorBenchmark>, String> {
    let library = read_library(&app)?;
    let video = library
        .videos
        .iter()
        .find(|item| item.id == local_video_id)
        .cloned()
        .ok_or_else(|| "Video was not found in the local library.".to_string())?;

    if !Path::new(&video.file_path).exists() {
        return Err("The source video no longer exists at its original path.".to_string());
    }

    let modes = [
        ("activity", "Activity + audio"),
        ("scene", "Scene cuts"),
        ("audio", "Audio pauses"),
        ("pyscenedetect", "PySceneDetect"),
    ];

    let mut results = Vec::new();
    for (mode, label) in modes {
        let started_at = now_ms();
        let result = analyze_video_by_mode(&video.file_path, mode);
        let elapsed_ms = now_ms().saturating_sub(started_at);
        match result {
            Ok(ranges) => results.push(DetectorBenchmark {
                mode: mode.to_string(),
                label: label.to_string(),
                available: true,
                candidate_count: ranges.len(),
                elapsed_ms,
                error: None,
            }),
            Err(error) => results.push(DetectorBenchmark {
                mode: mode.to_string(),
                label: label.to_string(),
                available: mode != "pyscenedetect" || !error.contains("not installed"),
                candidate_count: 0,
                elapsed_ms,
                error: Some(error),
            }),
        }
    }

    Ok(results)
}

#[tauri::command]
fn reject_candidate_clip(app: AppHandle, candidate_id: String) -> Result<CandidateClip, String> {
    let mut library = read_library(&app)?;
    let candidate = library
        .candidate_clips
        .iter_mut()
        .find(|candidate| candidate.id == candidate_id)
        .ok_or_else(|| "Candidate clip was not found in the local library.".to_string())?;

    candidate.status = "rejected".to_string();
    let updated_candidate = candidate.clone();
    write_library(&app, &library)?;
    Ok(updated_candidate)
}

#[tauri::command]
fn accept_candidate_clip(app: AppHandle, candidate_id: String) -> Result<CandidateClip, String> {
    let mut library = read_library(&app)?;
    let candidate = library
        .candidate_clips
        .iter_mut()
        .find(|candidate| candidate.id == candidate_id)
        .ok_or_else(|| "Candidate clip was not found in the local library.".to_string())?;

    candidate.status = "accepted".to_string();
    let updated_candidate = candidate.clone();
    write_library(&app, &library)?;
    Ok(updated_candidate)
}

#[tauri::command]
fn upsert_candidate_clip(
    app: AppHandle,
    input: CandidateClipInput,
) -> Result<CandidateClip, String> {
    if input.end_ms <= input.start_ms {
        return Err("Candidate end must be after candidate start.".to_string());
    }

    let mut library = read_library(&app)?;
    if !library
        .videos
        .iter()
        .any(|video| video.id == input.local_video_id)
    {
        return Err("Video was not found in the local library.".to_string());
    }

    if let Some(candidate_id) = input.candidate_id {
        let candidate = library
            .candidate_clips
            .iter_mut()
            .find(|candidate| candidate.id == candidate_id)
            .ok_or_else(|| "Candidate clip was not found in the local library.".to_string())?;
        candidate.session_id = input.session_id;
        candidate.local_video_id = input.local_video_id;
        candidate.start_ms = input.start_ms;
        candidate.end_ms = input.end_ms;
        candidate.status = "pending".to_string();
        candidate.source = Some("manual".to_string());
        candidate.confidence = None;
        let updated_candidate = candidate.clone();
        write_library(&app, &library)?;
        return Ok(updated_candidate);
    }

    let candidate = CandidateClip {
        id: id("candidate"),
        session_id: input.session_id,
        local_video_id: input.local_video_id,
        start_ms: input.start_ms,
        end_ms: input.end_ms,
        status: "pending".to_string(),
        source: Some("manual".to_string()),
        confidence: None,
        created_at: now_string(),
    };
    library.candidate_clips.push(candidate.clone());
    write_library(&app, &library)?;
    Ok(candidate)
}

#[tauri::command]
fn create_clip(app: AppHandle, input: CreateClipInput) -> Result<Clip, String> {
    if input.end_ms <= input.start_ms {
        return Err("Clip end must be after clip start.".to_string());
    }

    let mut library = read_library(&app)?;
    let video = library
        .videos
        .iter()
        .find(|item| item.id == input.local_video_id)
        .cloned()
        .ok_or_else(|| "Video was not found in the local library.".to_string())?;

    if !Path::new(&video.file_path).exists() {
        return Err("The source video no longer exists at its original path.".to_string());
    }

    let mut clip = Clip {
        id: id("clip"),
        session_id: input.session_id.or_else(|| video.session_id.clone()),
        local_video_id: input.local_video_id,
        start_ms: input.start_ms,
        end_ms: input.end_ms,
        title: input.title,
        exported_clip_path: None,
        point_result: input.point_result,
        point_ending: input.point_ending,
        shot_context: input.shot_context,
        notes: input.notes,
        tags: input.tags,
        events: Vec::new(),
        created_at: now_string(),
    };

    let output_path =
        ensure_mp4_extension(project_clips_dir(&app, &library, &clip)?.join(format!(
            "{}-{}",
            clip.id,
            safe_file_stem(&clip.title)
        )));
    clip.exported_clip_path = Some(export_clip(&video, &clip, &output_path)?);
    library.clips.insert(0, clip.clone());
    write_library(&app, &library)?;

    Ok(clip)
}

#[tauri::command]
fn delete_clip(app: AppHandle, clip_id: String) -> Result<(), String> {
    let mut library = read_library(&app)?;
    library.clips.retain(|clip| clip.id != clip_id);
    write_library(&app, &library)
}

#[tauri::command]
fn update_clip(app: AppHandle, input: UpdateClipInput) -> Result<Clip, String> {
    let mut library = read_library(&app)?;
    let clip = library
        .clips
        .iter_mut()
        .find(|clip| clip.id == input.clip_id)
        .ok_or_else(|| "Clip was not found in the local library.".to_string())?;

    clip.title = input.title;
    clip.point_result = input.point_result;
    clip.point_ending = input.point_ending;
    clip.shot_context = input.shot_context;
    clip.notes = input.notes;
    clip.tags = input.tags;
    clip.events = input.events;

    let updated_clip = clip.clone();
    write_library(&app, &library)?;
    Ok(updated_clip)
}

#[tauri::command]
fn export_reel_clip(app: AppHandle, input: ReelExportInput) -> Result<String, String> {
    let library = read_library(&app)?;
    let clip = library
        .clips
        .iter()
        .find(|clip| clip.id == input.clip_id)
        .cloned()
        .ok_or_else(|| "Clip was not found in the local library.".to_string())?;
    let video = library
        .videos
        .iter()
        .find(|video| video.id == clip.local_video_id)
        .cloned()
        .ok_or_else(|| "Source video was not found in the local library.".to_string())?;

    if !Path::new(&video.file_path).exists() {
        return Err("The source video no longer exists at its original path.".to_string());
    }

    let output_path =
        ensure_mp4_extension(project_reels_dir(&app, &library, &clip)?.join(format!(
            "{}-{}-reel",
            clip.id,
            safe_file_stem(&clip.title)
        )));
    export_reel(&video, &clip, &output_path, &input.keyframes)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            } else {
                tauri::WebviewWindowBuilder::new(
                    app,
                    "main",
                    tauri::WebviewUrl::App("index.html".into()),
                )
                .title("Raqet Desktop")
                .inner_size(1280.0, 820.0)
                .min_inner_size(960.0, 680.0)
                .build()?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_library,
            get_clips_folder,
            open_clips_folder,
            open_export_folder,
            open_data_folder,
            export_library_backup,
            import_library_backup,
            export_project_report,
            get_project_report_markdown,
            import_video,
            import_video_path,
            create_session,
            update_session,
            delete_session,
            assign_video_session,
            create_compatible_preview,
            detect_candidate_clips,
            benchmark_detectors,
            reject_candidate_clip,
            accept_candidate_clip,
            upsert_candidate_clip,
            create_clip,
            update_clip,
            export_reel_clip,
            delete_clip
        ])
        .run(tauri::generate_context!())
        .expect("error while running Raqet Desktop");
}
