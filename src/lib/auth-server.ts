import { NextRequest } from "next/server";
import { verifyJWT } from "./auth";
import prisma from "./db";

export async function getUserFromSession(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  if (!token) return null;
  const payload = await verifyJWT(token);
  if (!payload || !payload.userId) return null;

  try {
    const user = await prisma.user.findFirst({
      where: {
        id: payload.userId as string,
        isActive: true,
        isDeleted: false,
      },
    });
    if (!user) return null;
    return payload;
  } catch (error) {
    console.error("getUserFromSession database verification error:", error);
    return null;
  }
}
