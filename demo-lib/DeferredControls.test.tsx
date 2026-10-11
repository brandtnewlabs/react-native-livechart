import { act, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { DeferredControls } from "./DeferredControls";

it("mounts controls after two frame callbacks and cancels pending work on unmount", async () => {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  const request = jest.spyOn(global, "requestAnimationFrame").mockImplementation(callback => {
    callbacks.set(++nextId, callback);
    return nextId;
  });
  const cancel = jest.spyOn(global, "cancelAnimationFrame").mockImplementation(id => { if (id != null) callbacks.delete(id); });
  const screen = await render(<DeferredControls><Text>Controls</Text></DeferredControls>);
  expect(screen.queryByText("Controls")).toBeNull();
  await act(() => { callbacks.get(1)!(16); callbacks.delete(1); });
  expect(screen.queryByText("Controls")).toBeNull();
  await act(() => { callbacks.get(2)!(32); callbacks.delete(2); });
  expect(screen.getByText("Controls")).toBeTruthy();
  await screen.unmount();
  const pending = await render(<DeferredControls><Text>Pending</Text></DeferredControls>);
  const pendingId = nextId;
  await pending.unmount();
  expect(cancel).toHaveBeenCalledWith(pendingId);
  expect(callbacks.has(pendingId)).toBe(false);
  request.mockRestore();
  cancel.mockRestore();
});
