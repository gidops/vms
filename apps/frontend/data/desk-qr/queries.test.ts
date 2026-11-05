import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useObjectUrl } from "./queries";

describe("useObjectUrl", () => {
  const { createObjectURL, revokeObjectURL } = URL;
  afterEach(() => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  it("revokes the previous URL when the blob changes and on unmount", () => {
    let n = 0;
    // jsdom has no object URLs, so stand in for them.
    URL.createObjectURL = vi.fn(() => `blob:${++n}`);
    const revoke = vi.fn();
    URL.revokeObjectURL = revoke;

    const { result, rerender, unmount } = renderHook(
      ({ blob }: { blob?: Blob }) => useObjectUrl(blob),
      { initialProps: { blob: new Blob(["a"]) } },
    );
    expect(result.current).toBe("blob:1");

    rerender({ blob: new Blob(["b"]) });
    expect(result.current).toBe("blob:2");
    expect(revoke).toHaveBeenCalledWith("blob:1");

    unmount();
    expect(revoke).toHaveBeenCalledWith("blob:2");
  });
});
