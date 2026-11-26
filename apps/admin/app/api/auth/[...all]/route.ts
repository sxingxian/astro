import { getAuth } from "@/lib/auth";
import { BASE_PATH } from "@/lib/base-path";

export const dynamic = "force-dynamic";

/**
 * Better Auth matches requests on its full basePath (/admin/api/auth). Next can hand route handlers the URL
 * with its own basePath removed, so put /admin back before Better Auth sees it.
 */
function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(`${BASE_PATH}/`)) {
    url.pathname = `${BASE_PATH}${url.pathname}`;
    return getAuth().handler(new Request(url, request));
  }
  return getAuth().handler(request);
}

export { handler as GET, handler as POST };
