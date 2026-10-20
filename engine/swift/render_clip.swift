// render-clip: one Propagande clip, rendered natively with AVFoundation.
//  - 9:16 crop placed on the speaker's face (Vision face detection on sampled frames), or a fixed focus
//  - captions burned in from a JSON list of {t0, t1, text} (seconds, relative to the clip start)
//  - H.264 + AAC MP4, faster than real time
//
//  - optional taste layer: --style style.json (caption look) and --zooms zooms.json ([{t, scale, ramp}],
//    framing changes and punch-ins centred on the face, planned by engine/taste.py)
//
// usage: render-clip <in> <out.mp4> <start> <end> <captions.json|-> [--focus auto|0..1] [--w 1080 --h 1920]
//                    [--style style.json] [--zooms zooms.json]
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

// Framing plan: each entry scales the frame around the face (focus x, upper third), as a cut or a short ramp
struct Zoom: Decodable { let t: Double; let scale: Double; let ramp: Double? }
var zooms: [Zoom] = []
let zoomPath = opt("--zooms", "")
if !zoomPath.isEmpty, let d = try? Data(contentsOf: URL(fileURLWithPath: zoomPath)) {
    zooms = ((try? JSONDecoder().decode([Zoom].self, from: d)) ?? []).sorted { $0.t < $1.t }
}
let anchor = CGPoint(x: min(W * 0.85, max(W * 0.15, tx + centreX)), y: H * 0.38)
func framed(_ z: Double) -> CGAffineTransform {
    let k = CGFloat(max(1.0, z))
    return xf.concatenating(CGAffineTransform(translationX: -anchor.x, y: -anchor.y))
        .concatenating(CGAffineTransform(scaleX: k, y: k))
        .concatenating(CGAffineTransform(translationX: anchor.x, y: anchor.y))
}
let layerInstr = AVMutableVideoCompositionLayerInstruction(assetTrack: cv)
layerInstr.setTransform(framed(zooms.first?.t == 0 ? zooms[0].scale : 1.0), at: .zero)
var prevScale = zooms.first?.t == 0 ? zooms[0].scale : 1.0
for z in zooms where z.t > 0 && z.t < CMTimeGetSeconds(range.duration) {
    let at = CMTime(seconds: z.t, preferredTimescale: 600)
    if let r = z.ramp, r > 0.01 {
        layerInstr.setTransformRamp(fromStart: framed(prevScale), toEnd: framed(z.scale),
                                    timeRange: CMTimeRange(start: at, duration: CMTime(seconds: r, preferredTimescale: 600)))
    } else {
        layerInstr.setTransform(framed(z.scale), at: at)
    }
    prevScale = z.scale
}
let instr = AVMutableVideoCompositionInstruction()
instr.timeRange = CMTimeRange(start: .zero, duration: dur)
instr.layerInstructions = [layerInstr]
let vc = AVMutableVideoComposition()
vc.renderSize = CGSize(width: W, height: H)
vc.frameDuration = CMTime(value: 1, timescale: 30)
vc.instructions = [instr]

// Captions: drawn into bitmaps (CATextLayer text doesn't render in offscreen export on macOS).
// With per-word timing, one bitmap per spoken word lights that word in the style's active colour.
struct CapWord: Decodable { let w: String; let t0: Double; let t1: Double }
struct Cap: Decodable { let t0: Double; let t1: Double; let text: String; let words: [CapWord]? }
var caps: [Cap] = []
if capPath != "-", let d = try? Data(contentsOf: URL(fileURLWithPath: capPath)) {
    caps = (try? JSONDecoder().decode([Cap].self, from: d)) ?? []
}
struct CapStyle: Decodable {
    let `case`: String?; let font: String?; let size: Double?; let y: Double?
    let fill: String?; let active: String?; let stroke: String?; let stroke_width: Double?; let box: String?; let pop: Double?
}
struct Style: Decodable { let captions: CapStyle? }
var cs = CapStyle(case: "upper", font: "AvenirNext-Heavy", size: 0.072, y: 0.26, fill: "#FFFFFF", active: nil,
                  stroke: "#000000", stroke_width: 3.5, box: nil, pop: 0.14)
let stylePath = opt("--style", "")
if !stylePath.isEmpty, let d = try? Data(contentsOf: URL(fileURLWithPath: stylePath)), let st = try? JSONDecoder().decode(Style.self, from: d), let c = st.captions { cs = c }
func color(_ hex: String?) -> NSColor? {
    guard var h = hex?.trimmingCharacters(in: .whitespaces), h.hasPrefix("#") else { return nil }
    h.removeFirst()
    guard let v = UInt64(h, radix: 16) else { return nil }
    if h.count == 8 { return NSColor(srgbRed: CGFloat((v >> 24) & 255) / 255, green: CGFloat((v >> 16) & 255) / 255, blue: CGFloat((v >> 8) & 255) / 255, alpha: CGFloat(v & 255) / 255) }
    return NSColor(srgbRed: CGFloat((v >> 16) & 255) / 255, green: CGFloat((v >> 8) & 255) / 255, blue: CGFloat(v & 255) / 255, alpha: 1)
}
func cased(_ t: String) -> String {
    switch cs.case ?? "upper" {
    case "upper": return t.uppercased()
    case "lower": return t.lowercased()
    case "sentence": return t.prefix(1).uppercased() + t.dropFirst()
    default: return t
    }
}
let parent = CALayer(); parent.frame = CGRect(x: 0, y: 0, width: W, height: H)
let videoLayer = CALayer(); videoLayer.frame = parent.frame
parent.addSublayer(videoLayer)
let fontSize = W * CGFloat(cs.size ?? 0.072)
let font = NSFont(name: cs.font ?? "AvenirNext-Heavy", size: fontSize) ?? NSFont.boldSystemFont(ofSize: fontSize)
let fill = color(cs.fill) ?? .white, active = color(cs.active), stroke = color(cs.stroke), boxColor = color(cs.box)
let boxW = W * 0.86, boxH = font.pointSize * 2.8

func bitmap(_ words: [String], lit: Int?) -> CGImage? {
    let para = NSMutableParagraphStyle(); para.alignment = .center
    let shadow = NSShadow(); shadow.shadowColor = NSColor(white: 0, alpha: boxColor == nil ? 0.85 : 0); shadow.shadowBlurRadius = W * 0.012; shadow.shadowOffset = .zero
    let attr = NSMutableAttributedString()
    for (i, w) in words.enumerated() {
        var a: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: (i == lit ? (active ?? fill) : fill), .paragraphStyle: para, .shadow: shadow]
        if let s = stroke, (cs.stroke_width ?? 0) > 0 { a[.strokeColor] = s; a[.strokeWidth] = -(cs.stroke_width ?? 3.5) }
        attr.append(NSAttributedString(string: cased(w) + (i < words.count - 1 ? " " : ""), attributes: a))
    }
    let img = NSImage(size: NSSize(width: boxW, height: boxH))
    img.lockFocus()
    let bounds = attr.boundingRect(with: NSSize(width: boxW, height: boxH), options: [.usesLineFragmentOrigin, .usesFontLeading])
    let textRect = NSRect(x: 0, y: (boxH - bounds.height) / 2, width: boxW, height: bounds.height)
    if let bc = boxColor {
        let pad = font.pointSize * 0.35
        let r = NSRect(x: (boxW - bounds.width) / 2 - pad, y: textRect.minY - pad * 0.6, width: bounds.width + pad * 2, height: bounds.height + pad * 1.2)
        bc.setFill(); NSBezierPath(roundedRect: r, xRadius: pad, yRadius: pad).fill()
    }
    attr.draw(with: textRect, options: [.usesLineFragmentOrigin, .usesFontLeading])
    img.unlockFocus()
    var rect = NSRect(origin: .zero, size: img.size)
    return img.cgImage(forProposedRect: &rect, context: nil, hints: nil)
}
func show(_ image: CGImage?, from t0: Double, to t1: Double, pop: Bool) {
    let tl = CALayer()
    tl.contents = image
    tl.contentsGravity = .resizeAspect
    // CoreAnimation in AVFoundation is bottom-left origin: captions sit in the lower part, above platform UI
    tl.frame = CGRect(x: (W - boxW) / 2, y: H * CGFloat(cs.y ?? 0.26), width: boxW, height: boxH)
    tl.opacity = 0
    let a = CAKeyframeAnimation(keyPath: "opacity")
    a.values = [0, 1, 1, 0]; a.keyTimes = [0, 0.001, 0.999, 1]
    a.beginTime = AVCoreAnimationBeginTimeAtZero + t0; a.duration = max(0.001, t1 - t0); a.isRemovedOnCompletion = false
    tl.add(a, forKey: "show")
    if pop, (cs.pop ?? 0) > 0 {
        let p = CAKeyframeAnimation(keyPath: "transform.scale")
        p.values = [0.82, 1.06, 1.0]; p.keyTimes = [0, 0.5, 1]
        p.beginTime = AVCoreAnimationBeginTimeAtZero + t0; p.duration = cs.pop ?? 0.14; p.isRemovedOnCompletion = false
        tl.add(p, forKey: "pop")
    }
    parent.addSublayer(tl)
}
for c in caps {
    if let ws = c.words, !ws.isEmpty, active != nil {
        let texts = ws.map { $0.w }
        // one state per spoken word; a word shorter than ~2 frames merges into the previous state, so no state is
        // ever stretched past the next one (that drew two captions on top of each other for a frame)
        var states: [(from: Double, to: Double, lit: Int)] = []
        for (i, w) in ws.enumerated() {
            let from = i == 0 ? c.t0 : min(c.t1, max(c.t0, w.t0))
            let to = i == ws.count - 1 ? c.t1 : min(c.t1, max(from, ws[i + 1].t0))
            if to - from < 0.07, !states.isEmpty { states[states.count - 1].to = to; continue }
            states.append((from, to, i))
        }
        for (k, st) in states.enumerated() where st.to - st.from > 0.001 {
            show(bitmap(texts, lit: st.lit), from: st.from, to: st.to, pop: k == 0)
        }
    } else {
        show(bitmap(c.text.split(separator: " ").map(String.init), lit: nil), from: c.t0, to: c.t1, pop: true)
    }
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
print(String(format: "ok %@ focus=%.2f %.1fs %d captions %d framing changes", outURL.lastPathComponent, focus, CMTimeGetSeconds(dur), caps.count, zooms.count))
