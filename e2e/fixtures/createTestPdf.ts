const byteLength = (value: string) => Buffer.byteLength(value, "ascii");

export function createTestPdf(pageCount: number): Buffer {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new RangeError("pageCount must be a positive integer");
  }

  const pageObjectNumbers = Array.from(
    { length: pageCount },
    (_, index) => 4 + index * 2,
  );
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] /Count ${pageCount} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  for (let index = 0; index < pageCount; index += 1) {
    const content = `BT\n/F1 24 Tf\n72 720 Td\n(Page ${index + 1}) Tj\nET\n`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + index * 2} 0 R >>`,
      `<< /Length ${byteLength(content)} >>\nstream\n${content}endstream`,
    );
  }

  let pdf = "%PDF-1.7\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "ascii");
}
