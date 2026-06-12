/**
 * @jest-environment jsdom
 */

import { render } from "@testing-library/react";
import Navbar from "@/components/ui/Navbar";
import Hero from "@/components/sections/Hero";
import { resumeData } from "@/data/resume";
import {
  RESUME_DOWNLOAD_FILENAME,
  RESUME_PDF_API_PATH,
} from "@/lib/resumeDownload";

jest.mock("next-auth/react", () => ({
  useSession: () => ({ data: null }),
  signOut: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/",
}));

jest.mock("@/hooks/useTypewriter", () => ({
  useTypewriter: () => "Full-Stack Engineer",
}));

describe("resume download links", () => {
  it("navbar resume link uses download filename attribute", () => {
    const { container } = render(<Navbar />);
    const link = container.querySelector(`a[href="${RESUME_PDF_API_PATH}"]`);
    expect(link).not.toBeNull();
    expect(link?.getAttribute("download")).toBe(RESUME_DOWNLOAD_FILENAME);
  });

  it("hero resume link uses download filename attribute", () => {
    const { container } = render(
      <Hero personalInfo={resumeData.personalInfo} />
    );
    const link = container.querySelector(`a[href="${RESUME_PDF_API_PATH}"]`);
    expect(link).not.toBeNull();
    expect(link?.getAttribute("download")).toBe(RESUME_DOWNLOAD_FILENAME);
  });
});
