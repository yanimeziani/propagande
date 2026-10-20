// join-clips: joins rendered clips end to end into one MP4, keeping their size (used for cold opens:
// the punch line first, then the moment from its start). Inputs must share size and frame rate,
// which render-clip guarantees.
//
// usage: join-clips <out.mp4> <in1.mp4> <in2.mp4> [...]
import AVFoundation

let args = CommandLine.arguments
guard args.count >= 4 else {
    FileHandle.standardError.write("usage: join-clips <out.mp4> <in1.mp4> <in2.mp4> [...]\n".data(using: .utf8)!)
    exit(2)
}
let comp = AVMutableComposition()
let vt = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
let at = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
var cursor = CMTime.zero
for path in args[2...] {
    let asset = AVURLAsset(url: URL(fileURLWithPath: path))
    let range = CMTimeRange(start: .zero, duration: asset.duration)
    guard let v = asset.tracks(withMediaType: .video).first else { fatalError("no video track in \(path)") }
    try! vt.insertTimeRange(range, of: v, at: cursor)
    vt.preferredTransform = v.preferredTransform
    if let a = asset.tracks(withMediaType: .audio).first { try! at.insertTimeRange(range, of: a, at: cursor) }
    cursor = CMTimeAdd(cursor, asset.duration)
}
let out = URL(fileURLWithPath: args[1])
try? FileManager.default.removeItem(at: out)
guard let ex = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetPassthrough) else { fatalError("no export session") }
ex.outputURL = out
ex.outputFileType = .mp4
let sem = DispatchSemaphore(value: 0)
ex.exportAsynchronously { sem.signal() }
sem.wait()
if ex.status == .completed {
    print(String(format: "ok %.1f s", CMTimeGetSeconds(cursor)))
} else {
    FileHandle.standardError.write("failed: \(String(describing: ex.error))\n".data(using: .utf8)!)
    exit(1)
}
