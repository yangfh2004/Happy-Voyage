export async function waitForSeaFont(load: () => Promise<unknown>, timeout = 1500): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(load).catch(() => {}),
      new Promise<void>((resolve) => { timer = setTimeout(resolve, timeout); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
