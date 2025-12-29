export function resolveTemplateForDisplay(
  template: string,
  env: { userFolder?: string; steamDir?: string | null; steamUID?: string | undefined }
): string {
  const { userFolder, steamDir, steamUID } = env
  let result = template
  if (userFolder) {
    result = result.replaceAll('{AppData}', `${userFolder}\\AppData`)
    result = result.replaceAll('{UserFolder}', userFolder)
    result = result.replaceAll('{Home}', userFolder)
  }
  if (steamDir) result = result.replaceAll('{Steam}', steamDir)
  if (steamUID) result = result.replaceAll('{SteamUID}', steamUID)
  return result
}
