export type Level = 1 | 2 | 3

/** One entry from the 2027 Words of the Champions list, enriched with study info. */
export interface Word {
  id: number
  word: string
  level: Level
  /** Accepted alternate spellings (e.g. British spellings). */
  alts: string[]
  pos: string
  def: string
  syn: string[]
  sent: string
  origin: string
  hint: string
}

export const LEVEL_NAMES: Record<Level, string> = {
  1: 'One Bee',
  2: 'Two Bee',
  3: 'Three Bee',
}

export const LEVEL_BLURBS: Record<Level, string> = {
  1: 'Starter words — they mostly sound like they are spelled.',
  2: 'Trickier patterns and words from other languages.',
  3: 'Champion words — the hardest on the list!',
}
