export type Channel = "x" | "xhs";

export const ALL_CHANNEL = "all" as const;
export type ChannelFilter = typeof ALL_CHANNEL | Channel;

export function channelLabel(channel: Channel): string {
  switch (channel) {
    case "x":
      return "X";
    case "xhs":
      return "小红书";
  }
}

