import { resumeData } from "@/data/resume";
import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Skills from "@/components/sections/Skills";
import Experience from "@/components/sections/Experience";
import EducationSection from "@/components/sections/EducationSection";
import Projects from "@/components/sections/Projects";
import Contact from "@/components/sections/Contact";
import { FadeInSection } from "@/components/FadeInSection";
import { AssistantBot } from "@/components/AssistantBot";

export default function Home() {
  const { personalInfo, education } = resumeData;

  return (
    <main className="min-h-screen bg-background">
      {/* Hero has its own entrance animations */}
      <Hero personalInfo={personalInfo} />

      <FadeInSection>
        <About />
      </FadeInSection>

      <FadeInSection>
        <Skills />
      </FadeInSection>

      <FadeInSection>
        <Experience />
      </FadeInSection>

      <FadeInSection>
        <EducationSection education={education} />
      </FadeInSection>

      <FadeInSection>
        <Projects />
      </FadeInSection>

      <FadeInSection>
        <Contact />
      </FadeInSection>

      <AssistantBot />
    </main>
  );
}
