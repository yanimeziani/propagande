// extract-audio: the audio track of any video/audio file -> 16 kHz mono 16-bit WAV (what whisper.cpp wants).
// usage: extract-audio <in> <out.wav>
import AVFoundation

let args = CommandLine.arguments
guard args.count == 3 else { FileHandle.standardError.write("usage: extract-audio <in> <out.wav>\n".data(using: .utf8)!); exit(2) }
let asset = AVURLAsset(url: URL(fileURLWithPath: args[1]))
guard let track = asset.tracks(withMediaType: .audio).first else { FileHandle.standardError.write("no audio track\n".data(using: .utf8)!); exit(1) }
let reader = try! AVAssetReader(asset: asset)
let settings: [String: Any] = [
    AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: 16000, AVNumberOfChannelsKey: 1,
    AVLinearPCMBitDepthKey: 16, AVLinearPCMIsFloatKey: false, AVLinearPCMIsBigEndianKey: false, AVLinearPCMIsNonInterleaved: false,
]
let output = AVAssetReaderTrackOutput(track: track, outputSettings: settings)
reader.add(output)
reader.startReading()
var pcm = Data()
while let sb = output.copyNextSampleBuffer(), let bb = CMSampleBufferGetDataBuffer(sb) {
    var len = 0; var ptr: UnsafeMutablePointer<Int8>?
    CMBlockBufferGetDataPointer(bb, atOffset: 0, lengthAtOffsetOut: nil, totalLengthOut: &len, dataPointerOut: &ptr)
    if let p = ptr { pcm.append(UnsafeBufferPointer(start: UnsafeRawPointer(p).assumingMemoryBound(to: UInt8.self), count: len)) }
}
guard reader.status == .completed else { FileHandle.standardError.write("read failed\n".data(using: .utf8)!); exit(1) }
func le32(_ v: UInt32) -> Data { withUnsafeBytes(of: v.littleEndian) { Data($0) } }
func le16(_ v: UInt16) -> Data { withUnsafeBytes(of: v.littleEndian) { Data($0) } }
var wav = Data("RIFF".utf8); wav += le32(UInt32(36 + pcm.count)); wav += Data("WAVEfmt ".utf8)
wav += le32(16); wav += le16(1); wav += le16(1); wav += le32(16000); wav += le32(32000); wav += le16(2); wav += le16(16)
wav += Data("data".utf8); wav += le32(UInt32(pcm.count)); wav += pcm
try! wav.write(to: URL(fileURLWithPath: args[2]))
print(String(format: "ok %.1f s", Double(pcm.count) / 32000.0))
