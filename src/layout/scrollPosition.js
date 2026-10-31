const scrollPositions = new Map()
let restoreScrollOnNextNavigation = false
let requestedScrollTop = null

export const saveScrollPosition = (locationKey, top) => scrollPositions.set(locationKey, top)
export const getScrollPosition = (locationKey) => scrollPositions.get(locationKey) ?? 0
export const requestScrollRestore = (top) => {
  restoreScrollOnNextNavigation = true
  requestedScrollTop = Number.isFinite(top) ? top : null
}
export const takeScrollRestoreRequest = () => {
  const request = { requested: restoreScrollOnNextNavigation, top: requestedScrollTop }
  restoreScrollOnNextNavigation = false
  requestedScrollTop = null
  return request
}
