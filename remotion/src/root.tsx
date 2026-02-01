import { Composition } from "remotion";
import { MainVideo } from "./videos/main";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="Main"
        component={MainVideo}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={{
          headline: "Ship your Reddit growth plan",
          subhead: "Compliance-first roadmaps, drafts, scheduling, analytics",
        }}
      />
      <Composition
        id="Poster"
        component={MainVideo}
        durationInFrames={1}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={{
          headline: "ReditFast",
          subhead: "Reddit marketing without getting banned",
        }}
      />
    </>
  );
};
