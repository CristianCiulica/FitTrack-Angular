import AppKit
import Foundation

let fileManager = FileManager.default
let projectDirectory = URL(fileURLWithPath: fileManager.currentDirectoryPath)
let sourceURL = projectDirectory.appendingPathComponent("public/images/fittrack-logo.png")
let outputDirectory = projectDirectory.appendingPathComponent("public/icons")

guard let logo = NSImage(contentsOf: sourceURL) else {
  fputs("Unable to load \(sourceURL.path)\n", stderr)
  exit(1)
}

try fileManager.createDirectory(
  at: outputDirectory,
  withIntermediateDirectories: true
)

func renderIcon(size: Int, logoWidthRatio: CGFloat, fileName: String) throws {
  guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: size,
    pixelsHigh: size,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bitmapFormat: [],
    bytesPerRow: 0,
    bitsPerPixel: 0
  ) else {
    throw NSError(domain: "FitTrackIcons", code: 1)
  }

  bitmap.size = NSSize(width: size, height: size)

  NSGraphicsContext.saveGraphicsState()
  guard let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
    NSGraphicsContext.restoreGraphicsState()
    throw NSError(domain: "FitTrackIcons", code: 2)
  }
  NSGraphicsContext.current = context

  let canvas = NSRect(x: 0, y: 0, width: size, height: size)
  let gradient = NSGradient(colors: [
    NSColor(calibratedRed: 0.12, green: 0.28, blue: 0.62, alpha: 1),
    NSColor(calibratedRed: 0.27, green: 0.55, blue: 0.96, alpha: 1),
  ])
  gradient?.draw(in: canvas, angle: -45)

  let cardWidth = CGFloat(size) * 0.86
  let cardHeight = CGFloat(size) * 0.40
  let cardRect = NSRect(
    x: (CGFloat(size) - cardWidth) / 2,
    y: (CGFloat(size) - cardHeight) / 2,
    width: cardWidth,
    height: cardHeight
  )
  let cardPath = NSBezierPath(
    roundedRect: cardRect,
    xRadius: CGFloat(size) * 0.075,
    yRadius: CGFloat(size) * 0.075
  )
  NSColor.white.setFill()
  cardPath.fill()

  let sourceRatio = logo.size.width / logo.size.height
  let logoWidth = CGFloat(size) * logoWidthRatio
  let logoHeight = logoWidth / sourceRatio
  let logoRect = NSRect(
    x: (CGFloat(size) - logoWidth) / 2,
    y: (CGFloat(size) - logoHeight) / 2,
    width: logoWidth,
    height: logoHeight
  )
  logo.draw(
    in: logoRect,
    from: NSRect(origin: .zero, size: logo.size),
    operation: .sourceOver,
    fraction: 1
  )

  context.flushGraphics()
  NSGraphicsContext.restoreGraphicsState()

  guard let data = bitmap.representation(using: .png, properties: [:]) else {
    throw NSError(domain: "FitTrackIcons", code: 3)
  }
  try data.write(to: outputDirectory.appendingPathComponent(fileName))
}

for size in [72, 96, 128, 144, 152, 192, 384, 512] {
  try renderIcon(
    size: size,
    logoWidthRatio: 0.76,
    fileName: "icon-\(size)x\(size).png"
  )
}

try renderIcon(size: 180, logoWidthRatio: 0.76, fileName: "apple-touch-icon.png")
try renderIcon(size: 192, logoWidthRatio: 0.64, fileName: "maskable-icon-192x192.png")
try renderIcon(size: 512, logoWidthRatio: 0.64, fileName: "maskable-icon-512x512.png")

print("Generated FitTrack PWA icons in \(outputDirectory.path)")
