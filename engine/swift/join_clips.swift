// join-clips: joins rendered clips end to end into one MP4 at their own size (used for cold opens: the punch
// line first, then the moment from its start), and optionally lays a music track under the voice.
// Inputs must share size and frame rate, which render-clip guarantees. One input is fine (music only).
//
// usage: join-clips <out.mp4> <in1.mp4> [<in2.mp4> ...] [--music track --offset s --gain 0.14 --fade 0.4]
//   --offset  where to start in the music (engine/taste.py picks it so a beat lands on the cut)
import AVFoundation

let raw = Array(CommandLine.arguments.dropFirst())
var inputs: [String] = []
var opts: [String: String] = [:]
var i = 0
while i < raw.count {
    if raw[i].hasPrefix("--"), i + 1 < raw.count { opts[raw[i]] = raw[i + 1]; i += 2 } else { inputs.append(raw[i]); i += 1 }
}
guard inputs.count >= 2 else {
    FileHandle.standardError.write("usage: join-clips <out.mp4> <in1.mp4> [<in2.mp4> ...] [--music track --offset s --gain g --fade s]\n".data(using: .utf8)!)
    exit(2)
}
let outPath = inputs.removeFirst()

let comp = AVMutableComposition()
let vt = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
let at = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
var cursor = CMTime.zero
for path in inputs {
    let asset = AVURLAsset(url: URL(fileURLWithPath: path))
    let range = CMTimeRange(start: .zero, duration: asset.duration)
    guard let v = asset.tracks(withMediaType: .video).first else { fatalError("no video track in \(path)") }
    try! vt.insertTimeRange(range, of: v, at: cursor)
    vt.preferredTransform = v.preferredTransform
    if let a = asset.tracks(withMediaType: .audio).first { try! at.insertTimeRange(range, of: a, at: cursor) }
    cursor = CMTimeAdd(cursor, asset.duration)
}

var mix: AVMutableAudioMix? = nil
if let music = opts["--music"] {
    let m = AVURLAsset(url: URL(fileURLWithPath: music))
    guard let ma = m.tracks(withMediaType: .audio).first else { fatalError("no audio in \(music)") }
    let offset = CMTime(seconds: Double(opts["--offset"] ?? "0") ?? 0, preferredTimescale: 600)
    let avail = CMTimeSubtract(m.duration, offset)
    let len = CMTimeMinimum(cursor, avail)
    let mt = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
    try! mt.insertTimeRange(CMTimeRange(start: offset, duration: len), of: ma, at: .zero)
    let gain = Float(opts["--gain"] ?? "0.14") ?? 0.14
    let fade = CMTime(seconds: Double(opts["--fade"] ?? "0.4") ?? 0.4, preferredTimescale: 600)
    let p = AVMutableAudioMixInputParameters(track: mt)
    p.setVolumeRamp(fromStartVolume: 0, toEndVolume: gain, timeRange: CMTimeRange(start: .zero, duration: fade))
    p.setVolumeRamp(fromStartVolume: gain, toEndVolume: 0, timeRange: CMTimeRange(start: CMTimeSubtract(len, fade), duration: fade))
    let voice = AVMutableAudioMixInputParameters(track: at)
    voice.setVolume(1.0, at: .zero)
    mix = AVMutableAudioMix(); mix!.inputParameters = [voice, p]
}

let out = URL(fileURLWithPath: outPath)
try? FileManager.default.removeItem(at: out)
// Passthrough keeps the video untouched; mixing music needs the audio re-encoded, so use a full export then
let preset = mix == nil ? AVAssetExportPresetPassthrough : AVAssetExportPresetHighestQuality
guard let ex = AVAssetExportSession(asset: comp, presetName: preset) else { fatalError("no export session") }
ex.outputURL = out
ex.outputFileType = .mp4
ex.audioMix = mix
let sem = DispatchSemaphore(value: 0)
ex.exportAsynchronously { sem.signal() }
sem.wait()
if ex.status == .completed {
    print(String(format: "ok %.1f s%@", CMTimeGetSeconds(cursor), mix == nil ? "" : " + music"))
} else {
    FileHandle.standardError.write("failed: \(String(describing: ex.error))\n".data(using: .utf8)!)
    exit(1)
}
