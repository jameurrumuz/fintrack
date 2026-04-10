
'use client';

// This is a simple layout wrapper. We might not need it, but it's good practice
// to have a layout file for each route segment.
export default function UserPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
