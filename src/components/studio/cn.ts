/** Penggabung className sederhana tanpa dependensi tambahan. */
export const cn = (
  ...classes: Array<string | false | null | undefined>
): string => classes.filter(Boolean).join(" ");
