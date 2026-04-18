export type ThumbSize = "strip" | "card" | "reader";

export function thumbUrl(
  comicId: string,
  pageIndex: number,
  size: ThumbSize,
): string {
  return `/resources/thumb/${comicId}/${pageIndex}/${size}`;
}