import {
  BinaryBitmap,
  HybridBinarizer,
  RGBLuminanceSource,
  DecodeHintType,
  BarcodeFormat,
  MultiFormatOneDReader,
  QRCodeReader,
  MicroQRCodeReader,
  DataMatrixReader,
  AztecCodeReader,
  PDF417Reader,
} from "@zxing/library";
const expected = new Set([
  "NotFoundException",
  "ChecksumException",
  "FormatException",
]);
// Avoid the upstream MultiFormatReader's incorrect ReaderException classification
// and the browser canvas luminance source's failing automatic-rotation path.
// Orientation is handled explicitly by Scanner's rotated canvas.
export function createCameraDecoder(mode = "auto") {
  const hints = new Map([[DecodeHintType.TRY_HARDER, true]]);
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_93,
    BarcodeFormat.ITF,
    BarcodeFormat.CODABAR,
    BarcodeFormat.RSS_14,
  ]);
  const readers =
    mode === "qr"
      ? [new QRCodeReader()]
      : mode === "barcode"
        ? [new MultiFormatOneDReader(hints)]
        : [
            new MultiFormatOneDReader(hints),
            new QRCodeReader(),
            new MicroQRCodeReader(),
            new DataMatrixReader(),
            new AztecCodeReader(),
            new PDF417Reader(),
          ];
  return (canvas) => {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context)
      throw Error("Camera image processing is unavailable in this browser.");
    const { width, height } = canvas;
    const rgba = context.getImageData(0, 0, width, height).data;
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j++)
      gray[j] =
        (rgba[i] * 306 + rgba[i + 1] * 601 + rgba[i + 2] * 117 + 512) >> 10;
    const bitmap = new BinaryBitmap(
      new HybridBinarizer(new RGBLuminanceSource(gray, width, height)),
    );
    for (const reader of readers) {
      try {
        return reader.decode(bitmap, hints).getText();
      } catch (error) {
        if (
          !expected.has(error?.constructor?.kind) &&
          !expected.has(error?.name)
        )
          throw error;
      } finally {
        reader.reset();
      }
    }
    return "";
  };
}
