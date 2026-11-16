// The route files were written for Next.js and import NextResponse from "next/server".
// In the backend that import resolves here: a plain web Response with the same static json() helper.
export class NextResponse extends Response {
  static override json(body: unknown, init?: ResponseInit): Response {
    return Response.json(body, init);
  }
}
