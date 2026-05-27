import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth-server";
import { writeAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getUserFromSession(req);

    if (sessionUser) {
      await writeAuditLog({
        action: "LOGOUT",
        targetTable: "User",
        targetId: sessionUser.userId as string,
        userId: sessionUser.userId as string,
        details: "User logged out.",
      });
    }

    const response = NextResponse.json({ message: "Logout successful." });
    
    // Clear session cookie
    response.cookies.set("session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("Logout API error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
