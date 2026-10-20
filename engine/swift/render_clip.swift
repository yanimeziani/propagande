// render-clip: one Propagande clip, rendered natively with AVFoundation.
//  - 9:16 crop placed on the speaker's face (Vision face detection on sampled frames), or a fixed focus
//  - captions burned in from a JSON list of {t0, t1, text} (seconds, relative to the clip start)
//  - H.264 + AAC MP4, faster than real time
//
// usage: render-clip <in> <out.mp4> <start> <end> <captions.json|-> [--focus auto|0..1] [--w 1080 --h 1920]
import AVFoundation
import AppKit
import QuartzCore
import Vision

let args = CommandLine.arguments
guard args.count >= 6 else {
    FileHandle.standardError.write("usage: render-clip <in> <out.mp4> <start> <end> <captions.json|-> [--focus auto|0..1]\n".data(using: .utf8)!)
    exit(2)
}
func opt(_ name: String, _ def: String) -> String {
    if let i = args.firstIndex(of: name), i + 1 < args.count { return args[i + 1] }
    return def
}
let inURL = URL(fileURLWithPath: args[1]), outURL = URL(fileURLWithPath: args[2])
let start = Double(args[3])!, end = Double(args[4])!, capPath = args[5]
let W = CGFloat(Double(opt("--w", "1080"))!), H = CGFloat(Double(opt("--h", "1920"))!)
let focusArg = opt("--focus", "auto")

let asset = AVURLAsset(url: inURL)
guard let vTrack = asset.tracks(withMediaType: .video).first else { fatalError("no video track") }
let aTrack = asset.tracks(withMediaType: .audio).first
let range = CMTimeRange(start: CMTime(seconds: start, preferredTimescale: 600), end: CMTime(seconds: end, preferredTimescale: 600))

// Oriented source size
let t0 = vTrack.preferredTransform
let natural = vTrack.naturalSize.applying(t0)
let srcW = abs(natural.width), srcH = abs(natural.height)

// Where to put the crop: median face centre over ~1 frame per second
func autoFocus() -> CGFloat {
    let gen = AVAssetImageGenerator(asset: asset)
    gen.appliesPreferredTrackTransform = true
    gen.maximumSize = CGSize(width: 640, height: 640)
    var xs: [CGFloat] = []
    var t = start + 0.2
    while t < end {
        if let img = try? gen.copyCGImage(at: CMTime(seconds: t, preferredTimescale: 600), actualTime: nil) {
            let req = VNDetectFaceRectanglesRequest()
            try? VNImageRequestHandler(cgImage: img, options: [:]).perform([req])
            if let faces = req.results, !faces.isEmpty {
                let biggest = faces.max { $0.boundingBox.width * $0.boundingBox.height < $1.boundingBox.width * $1.boundingBox.height }!
                xs.append(biggest.boundingBox.midX)
            }
        }
        t += 1.0
    }
    guard !xs.isEmpty else { return 0.5 }
    xs.sort()
    return xs[xs.count / 2]
}
let focus: CGFloat = focusArg == "auto" ? autoFocus() : CGFloat(Double(focusArg) ?? 0.5)

// Composition: the clip range, video + audio
let comp = AVMutableComposition()
let cv = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
try! cv.insertTimeRange(range, of: vTrack, at: .zero)
if let a = aTrack {
    let ca = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
    try! ca.insertTimeRange(range, of: a, at: .zero)
}
let dur = comp.duration

// Scale to fill 9:16, then slide horizontally so the face sits in the frame
let scale = max(W / srcW, H / srcH)
let scaledW = srcW * scale
let centreX = focus * scaledW
var tx = W / 2 - centreX
tx = min(0, max(W - scaledW, tx))
let ty = (H - srcH * scale) / 2
var xf = t0
// normalise the preferred transform's origin, then scale and move
let box = CGRect(origin: .zero, size: vTrack.naturalSize).applying(t0)
xf = xf.concatenating(CGAffineTransform(translationX: -box.minX, y: -box.minY))
xf = xf.concatenating(CGAffineTransform(scaleX: scale, y: scale))
xf = xf.concatenating(CGAffineTransform(translationX: tx, y: ty))

let layerInstr = AVMutableVideoCompositionLayerInstruction(assetTrack: cv)
layerInstr.setTransform(xf, at: .zero)
let instr = AVMutableVideoCompositionInstruction()
instr.timeRange = CMTimeRange(start: .zero, duration: dur)
instr.layerInstructions = [layerInstr]
let vc = AVMutableVideoComposition()
vc.renderSize = CGSize(width: W, height: H)
vc.frameDuration = CMTime(value: 1, timescale: 30)
vc.instructions = [instr]

// Captions: one CATextLayer per chunk, popping in on its own time window
struct Cap: Decodable { let t0: Double; let t1: Double; let text: String }
var caps: [Cap] = []
if capPath != "-", let d = try? Data(contentsOf: URL(fileURLWithPath: capPath)) {
    caps = (try? JSONDecoder().decode([Cap].self, from: d)) ?? []
}
let parent = CALayer(); parent.frame = CGRect(x: 0, y: 0, width: W, height: H)
let videoLayer = CALayer(); videoLayer.frame = parent.frame
parent.addSublayer(videoLayer)
let font = NSFont(name: "AvenirNext-Heavy", size: W * 0.072) ?? NSFont.boldSystemFont(ofSize: W * 0.072)
for c in caps {
    let text = c.text.uppercased()
    let para = NSMutableParagraphStyle(); para.alignment = .center
    let shadow = NSShadow(); shadow.shadowColor = NSColor(white: 0, alpha: 0.85); shadow.shadowBlurRadius = W * 0.012; shadow.shadowOffset = .zero
    let attr = NSAttributedString(string: text, attributes: [
        .font: font, .foregroundColor: NSColor.white, .paragraphStyle: para,
        .strokeColor: NSColor.black, .strokeWidth: -3.5, .shadow: shadow,
    ])
    // Draw the caption into a bitmap ourselves: CATextLayer text doesn't render in offscreen export on macOS
    let boxW = W * 0.86, boxH = font.pointSize * 2.8
    let img = NSImage(size: NSSize(width: boxW, height: boxH))
    img.lockFocus()
    let bounds = attr.boundingRect(with: NSSize(width: boxW, height: boxH), options: [.usesLineFragmentOrigin, .usesFontLeading])
    attr.draw(with: NSRect(x: 0, y: (boxH - bounds.height) / 2, width: boxW, height: bounds.height), options: [.usesLineFragmentOrigin, .usesFontLeading])
    img.unlockFocus()
    var rect = NSRect(origin: .zero, size: img.size)
    let tl = CALayer()
    tl.contents = img.cgImage(forProposedRect: &rect, context: nil, hints: nil)
    tl.contentsGravity = .resizeAspect
    // CoreAnimation in AVFoundation is bottom-left origin: put captions in the lower third, above platform UI
    tl.frame = CGRect(x: (W - boxW) / 2, y: H * 0.26, width: boxW, height: boxH)
    let debugStatic = ProcessInfo.processInfo.environment["DEBUG_CAPS"] == "1"
    tl.opacity = debugStatic ? 1 : 0
    if debugStatic { parent.addSublayer(tl); continue }
    let show = CAKeyframeAnimation(keyPath: "opacity")
    show.values = [0, 1, 1, 0]
    show.keyTimes = [0, 0.001, 0.999, 1]
    show.beginTime = AVCoreAnimationBeginTimeAtZero + c.t0
    show.duration = max(0.05, c.t1 - c.t0)
    show.isRemovedOnCompletion = false
    tl.add(show, forKey: "show")
    let pop = CAKeyframeAnimation(keyPath: "transform.scale")
    pop.values = [0.82, 1.06, 1.0]
    pop.keyTimes = [0, 0.5, 1]
    pop.beginTime = AVCoreAnimationBeginTimeAtZero + c.t0
    pop.duration = 0.14
    pop.isRemovedOnCompletion = false
    tl.add(pop, forKey: "pop")
    parent.addSublayer(tl)
}
vc.animationTool = AVVideoCompositionCoreAnimationTool(postProcessingAsVideoLayer: videoLayer, in: parent)

try? FileManager.default.removeItem(at: outURL)
let ex = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetHighestQuality)!
ex.outputURL = outURL
ex.outputFileType = .mp4
ex.videoComposition = vc
ex.shouldOptimizeForNetworkUse = true
let sem = DispatchSemaphore(value: 0)
ex.exportAsynchronously { sem.signal() }
sem.wait()
guard ex.status == .completed else { fatalError("export failed: \(String(describing: ex.error))") }
print(String(format: "ok %@ focus=%.2f %.1fs %d captions", outURL.lastPathComponent, focus, CMTimeGetSeconds(dur), caps.count))
