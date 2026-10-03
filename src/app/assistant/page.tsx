"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * The standalone assistant is hidden: Ask Parthia (the docked patient agent)
 * is the one place a patient asks questions. Anyone arriving on this old URL
 * is sent home.
 */
export default function AssistantPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/"); }, [router]);
  return null;
}
