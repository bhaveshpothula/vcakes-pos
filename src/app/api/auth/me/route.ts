import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth-server";

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getUserFromSession(req);

    if (!sessionUser) {
      const response = NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      );
      response.cookies.set("session", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return response;
    }

    return NextResponse.json({
      user: {
        id: sessionUser.userId,
        email: sessionUser.email,
        name: sessionUser.name,
        role: sessionUser.role,
      },
    });
  } catch (error) {
    console.error("Profile API error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
