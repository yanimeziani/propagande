// reference: measures a reference (a clip you like, or a design shot from Pinterest or Dribbble) and writes a
// Propagande style preset. It measures; it copies nothing: no pixels, fonts or footage go into your clips.
//   video  → cut rhythm (median shot length) + the captions on screen (position, size, case, words, colours)
//   image  → the captions or headline on it, plus the palette
//
// usage: reference <file> <out.json> [--name my-style]
import AVFoundation
import AppKit
import Vision

let args = CommandLine.arguments
guard args.count >= 3 else { FileHandle.standardError.write("usage: reference <file> <out.json> [--name n]\n".data(using: .utf8)!); exit(2) }
let inPath = args[1], outPath = args[2]
let name = args.firstIndex(of: "--name").flatMap { $0 + 1 < args.count ? args[$0 + 1] : nil } ?? "reference"
let url = URL(fileURLWithPath: inPath)
let isImage = NSImage(contentsOf: url) != nil && !["mp4", "mov", "m4v", "webm"].contains(url.pathExtension.lowercased())

// ---------------------------------------------------------------- pixels
struct RGB { var r: Double; var g: Double; var b: Double
    var lum: Double { 0.2126 * r + 0.7152 * g + 0.0722 * b }
    var sat: Double { let mx = max(r, g, b), mn = min(r, g, b); return mx == 0 ? 0 : (mx - mn) / mx }
    func dist(_ o: RGB) -> Double { (r - o.r) * (r - o.r) + (g - o.g) * (g - o.g) + (b - o.b) * (b - o.b) }
    var hex: String { String(format: "#%02X%02X%02X", Int(max(0, min(255, r))), Int(max(0, min(255, g))), Int(max(0, min(255, b)))) }
}
func pixels(_ img: CGImage, maxSide: Int = 320) -> (w: Int, h: Int, px: [RGB]) {
    let s = min(1.0, Double(maxSide) / Double(max(img.width, img.height)))
    let w = max(1, Int(Double(img.width) * s)), h = max(1, Int(Double(img.height) * s))
    var buf = [UInt8](repeating: 0, count: w * h * 4)
    let ctx = CGContext(data: &buf, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
    var px: [RGB] = []; px.reserveCapacity(w * h)
    for i in 0..<(w * h) { px.append(RGB(r: Double(buf[i * 4]), g: Double(buf[i * 4 + 1]), b: Double(buf[i * 4 + 2]))) }
    return (w, h, px)
}
func kmeans(_ pts: [RGB], k: Int, iters: Int = 12) -> [(RGB, Int)] {
    guard pts.count >= k else { return pts.map { ($0, 1) } }
    let sorted = pts.sorted { $0.lum < $1.lum }
    var c = (0..<k).map { sorted[min(sorted.count - 1, ($0 * 2 + 1) * sorted.count / (2 * k))] }
    var counts = [Int](repeating: 0, count: k)
    for _ in 0..<iters {
        var sum = [RGB](repeating: RGB(r: 0, g: 0, b: 0), count: k); counts = [Int](repeating: 0, count: k)
        for p in pts {
            var bi = 0, bd = Double.infinity
            for j in 0..<k { let d = p.dist(c[j]); if d < bd { bd = d; bi = j } }
            sum[bi].r += p.r; sum[bi].g += p.g; sum[bi].b += p.b; counts[bi] += 1
        }
        for j in 0..<k where counts[j] > 0 { c[j] = RGB(r: sum[j].r / Double(counts[j]), g: sum[j].g / Double(counts[j]), b: sum[j].b / Double(counts[j])) }
    }
    return zip(c, counts).map { ($0, $1) }.sorted { $0.1 > $1.1 }
}

// ---------------------------------------------------------------- text on a frame
struct Seen { let text: String; let cx: Double; let cy: Double; let h: Double; let words: Int; let upper: Double; let fill: RGB?; let active: RGB?; let box: RGB?; let outlined: Bool }
func readText(_ img: CGImage) -> [Seen] {
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.recognitionLanguages = ["fr-FR", "en-US"]
    try? VNImageRequestHandler(cgImage: img, options: [:]).perform([req])
    let (w, h, px) = pixels(img)
    var out: [Seen] = []
    for o in req.results ?? [] {
        guard let t = o.topCandidates(1).first, t.confidence > 0.4 else { continue }
        let bb = o.boundingBox
        guard bb.height > 0.02, t.string.count >= 2 else { continue }  // caption-sized text only
        let letters = t.string.filter { $0.isLetter }
        let upper = letters.isEmpty ? 0 : Double(letters.filter { $0.isUppercase }.count) / Double(letters.count)
        // pixels inside the text box, and a ring just outside it
        let x0 = Int(bb.minX * Double(w)), x1 = Int(bb.maxX * Double(w)), y0 = Int((1 - bb.maxY) * Double(h)), y1 = Int((1 - bb.minY) * Double(h))
        var inside: [RGB] = [], ring: [RGB] = []
        let pad = max(2, (y1 - y0) / 3)
        for y in max(0, y0 - pad)..<min(h, y1 + pad) {
            for x in max(0, x0 - pad)..<min(w, x1 + pad) {
                let p = px[y * w + x]
                if x >= x0 && x < x1 && y >= y0 && y < y1 { inside.append(p) } else { ring.append(p) }
            }
        }
        guard inside.count > 20, ring.count > 10 else { continue }
        let bg = kmeans(ring, k: 1)[0].0
        let ringSpread = ring.reduce(0.0) { $0 + $1.dist(bg) } / Double(ring.count)
        let cl = kmeans(inside, k: 3).filter { Double($0.1) / Double(inside.count) > 0.04 }
        let fg = cl.filter { $0.0.dist(bg) > 2500 }  // clearly different from what's around the text
        // the letters, not their outline: among neutral clusters, a light one wins over a near-black stroke
        // Classic captions are light letters with a dark outline: when both are in the box, that's the answer,
        // even if the letters are close to a light background
        let whiteish = cl.filter { $0.0.lum > 195 && $0.0.sat < 0.15 }.max { $0.0.lum < $1.0.lum }?.0
        let darkish = cl.contains { $0.0.lum < 110 && $0.0.sat < 0.3 }
        let outlined = whiteish != nil && darkish
        let neutral = fg.filter { $0.0.sat < 0.3 }
        let light = neutral.filter { $0.0.lum > 60 }
        let fill = outlined ? whiteish : (light.isEmpty ? neutral : light).max { abs($0.0.lum - bg.lum) < abs($1.0.lum - bg.lum) }?.0
        let active = fg.filter { $0.0.sat >= 0.35 }.max { $0.1 < $1.1 }?.0
        let box: RGB? = ringSpread < 900 ? bg : nil  // a flat band behind the text
        if ProcessInfo.processInfo.environment["REF_DEBUG"] == "1" {
            FileHandle.standardError.write("\(t.string) bg=\(bg.hex) spread=\(Int(ringSpread)) clusters=\(cl.map { "\($0.0.hex):\($0.1)" }) fill=\(fill?.hex ?? "-")\n".data(using: .utf8)!)
        }
        out.append(Seen(text: t.string.lowercased(), cx: Double(bb.midX), cy: Double(bb.midY), h: Double(bb.height), words: t.string.split(separator: " ").count, upper: upper, fill: fill, active: active, box: outlined ? nil : box, outlined: outlined))
    }
    return out
}

// ---------------------------------------------------------------- read the reference
var frames: [CGImage] = []
var shotMedian: Double? = nil, cutsPerMin: Double? = nil, frameAspect = 9.0 / 16.0
if isImage {
    var r = NSRect.zero
    if let cg = NSImage(contentsOf: url)?.cgImage(forProposedRect: &r, context: nil, hints: nil) { frames = [cg]; frameAspect = Double(cg.width) / Double(cg.height) }
} else {
    let asset = AVURLAsset(url: url)
    let dur = CMTimeGetSeconds(asset.duration)
    let gen = AVAssetImageGenerator(asset: asset)
    gen.appliesPreferredTrackTransform = true
    gen.maximumSize = CGSize(width: 720, height: 720)
    gen.requestedTimeToleranceBefore = .zero; gen.requestedTimeToleranceAfter = .zero
    var t = 0.5
    while t < min(dur, 90) { if let cg = try? gen.copyCGImage(at: CMTime(seconds: t, preferredTimescale: 600), actualTime: nil) { frames.append(cg) }; t += 0.5 }
    if let f = frames.first { frameAspect = Double(f.width) / Double(f.height) }
    // cut rhythm: mean luma difference between frames ~10 times a second
    let track = asset.tracks(withMediaType: .video)[0]
    let reader = try! AVAssetReader(asset: asset)
    let o = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
                                                                    kCVPixelBufferWidthKey as String: 64, kCVPixelBufferHeightKey as String: 36])
    reader.add(o); reader.startReading()
    var prev: [Float]? = nil, cuts: [Double] = [], last = -1.0
    while let sb = o.copyNextSampleBuffer() {
        let ts = CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sb))
        if ts - last < 0.1 { continue }; last = ts
        guard let pb = CMSampleBufferGetImageBuffer(sb) else { continue }
        CVPixelBufferLockBaseAddress(pb, .readOnly)
        let base = CVPixelBufferGetBaseAddress(pb)!.assumingMemoryBound(to: UInt8.self), bpr = CVPixelBufferGetBytesPerRow(pb)
        var v = [Float](); v.reserveCapacity(64 * 36)
        for y in 0..<CVPixelBufferGetHeight(pb) { for x in 0..<CVPixelBufferGetWidth(pb) { let p = base + y * bpr + x * 4; v.append((Float(p[0]) + Float(p[1]) + Float(p[2])) / 3) } }
        CVPixelBufferUnlockBaseAddress(pb, .readOnly)
        if let q = prev {
            var d: Float = 0; for i in 0..<v.count { d += abs(v[i] - q[i]) }; d /= Float(v.count)
            if d > 28 && (cuts.last.map { ts - $0 > 0.4 } ?? true) { cuts.append(ts) }
        }
        prev = v
    }
    let gaps = zip(cuts.dropFirst(), cuts).map { $0 - $1 }.sorted()
    if !gaps.isEmpty { shotMedian = gaps[gaps.count / 2] }
    if dur > 0 { cutsPerMin = Double(cuts.count) / dur * 60 }
}

var seen: [Seen] = []
for f in frames { seen += readText(f) }
// Set decor (posters, screens, signs) sits in the same place frame after frame; captions change. Drop text that
// shows up at the same spot in more than a fifth of the frames.
if frames.count >= 10 {
    var count: [String: Int] = [:]
    func key(_ x: Seen) -> String { "\(x.text)|\(Int(x.cx * 10))|\(Int(x.cy * 10))" }
    for x in seen { count[key(x), default: 0] += 1 }
    let limit = max(3, frames.count / 5)
    seen = seen.filter { count[key($0)]! <= limit }
}
func median(_ xs: [Double]) -> Double? { xs.isEmpty ? nil : xs.sorted()[xs.count / 2] }
// per-channel median: one odd frame doesn't drag the colour toward grey
func avg(_ cs: [RGB]) -> RGB? { cs.isEmpty ? nil : RGB(r: median(cs.map { $0.r })!, g: median(cs.map { $0.g })!, b: median(cs.map { $0.b })!) }

// palette of the whole reference (useful for design shots)
var palette: [String] = []
if let f = frames.first { palette = kmeans(pixels(f, maxSide: 160).px, k: 6).map { $0.0.hex } }

// ---------------------------------------------------------------- the preset
let textH = median(seen.map { $0.h })            // fraction of frame height
let cy = median(seen.map { $0.cy })               // 0 = bottom
let words = median(seen.map { Double($0.words) })
let upper = median(seen.map { $0.upper })
let fill = avg(seen.compactMap { $0.fill })
let active = avg(seen.compactMap { $0.active })
let boxes = seen.compactMap { $0.box }
let box = Double(boxes.count) > Double(seen.count) * 0.5 ? avg(boxes) : nil
let outlinedShare = seen.isEmpty ? 0 : Double(seen.filter { $0.outlined }.count) / Double(seen.count)

// font size as a fraction of the width of a 9:16 frame, from the text line height in the reference
let sizeW: Double = textH.map { min(0.11, max(0.04, $0 / frameAspect * 0.85 * (9.0 / 16.0) / (9.0 / 16.0))) } ?? 0.072
let boxFrac = 2.8 * sizeW * (9.0 / 16.0)          // caption box height / frame height in our renderer
let yParam: Double = cy.map { min(0.7, max(0.08, $0 - boxFrac / 2)) } ?? 0.26
let shot = shotMedian.map { min(6.0, max(0.8, $0)) }
let fast = (shot ?? 2.2) < 1.6
var captions: [String: Any] = [
    "case": (upper ?? 1) > 0.8 ? "upper" : "sentence",
    "max_words": Int(min(6, max(1, (words ?? 3).rounded()))),
    "max_chars": Int(min(36, max(10, (words ?? 3) * 6.5))),
    "font": (upper ?? 1) > 0.8 ? "AvenirNext-Heavy" : "AvenirNext-DemiBold",
    "size": (sizeW * 1000).rounded() / 1000,
    "y": (yParam * 100).rounded() / 100,
    "fill": fill?.hex ?? "#FFFFFF",
    "stroke": (box == nil || outlinedShare > 0.5) ? "#000000" : NSNull(),
    "stroke_width": (box == nil || outlinedShare > 0.5) ? 3.5 : 0,
    "box": box.map { $0.hex + "B3" } ?? NSNull(),
    "pop": fast ? 0.12 : 0.14,
]
captions["active"] = active?.hex ?? NSNull()
var pacing: [String: Any] = ["min_gap": fast ? 0.7 : 1.0, "keyword_gap": fast ? 2.0 : 3.0, "ramp": 0.0]
pacing["shot_seconds"] = ((shot ?? 2.2) * 10).rounded() / 10
pacing["alt_scale"] = fast ? 1.12 : 1.08
pacing["punch_scale"] = fast ? 1.25 : 1.18
let preset: [String: Any] = [
    "name": name,
    "label": "Measured from \(url.lastPathComponent)",
    "captions": captions,
    "pacing": pacing,
    "measured": [
        "kind": isImage ? "image" : "video",
        "frames_read": frames.count, "text_lines_seen": seen.count,
        "median_shot_seconds": shotMedian ?? NSNull(), "cuts_per_minute": cutsPerMin.map { ($0 * 10).rounded() / 10 } ?? NSNull(),
        "palette": palette,
    ] as [String: Any],
]
let data = try! JSONSerialization.data(withJSONObject: preset, options: [.prettyPrinted, .sortedKeys])
try! data.write(to: URL(fileURLWithPath: outPath))
print(String(data: data, encoding: .utf8)!)
