import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/invite(.*)",
]);

// Route redirects: old sidebar routes → new tab query params
const TAB_REDIRECTS: Record<string, string> = {
  "/dashboard/features": "/dashboard?tab=features",
  "/dashboard/milestones": "/dashboard?tab=milestones",
  "/dashboard/settings": "/dashboard?tab=settings",
  "/dashboard/help": "/dashboard?tab=settings",
};

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;

  // Redirect old routes to tab-based URLs
  const redirect = TAB_REDIRECTS[pathname];
  if (redirect) {
    const url = request.nextUrl.clone();
    const redirectUrl = new URL(redirect, url.origin);
    // Preserve any existing query params (e.g. ?id=xxx)
    request.nextUrl.searchParams.forEach((value, key) => {
      redirectUrl.searchParams.set(key, value);
    });
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect bare /dashboard to default tab
  if (pathname === "/dashboard" && !request.nextUrl.searchParams.has("tab")) {
    const url = request.nextUrl.clone();
    url.searchParams.set("tab", "milestones");
    return NextResponse.redirect(url);
  }

  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
