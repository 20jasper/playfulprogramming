/**
 * This hook is meant to provide a utility that can be used to compose functionality
 * for a popover component. This includes the `expanded` property handling as well
 * as the props to be added to the trigger button
 *
 * ✅ Have an open and closed state handlers
 * ✅ Close on escape key
 * ✅ Close on click outside
 * ✅ Focus on popover area upon opening
 * 🐛 Doesn't seem to close on focus loss
 *       Needs an optional prop (?)
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { useOutsideClick, useOutsideFocus } from "../outside-events"

/**
 * @callback onBtnClickFn
 * @param {React.MouseEvent} e - The associated event to handle
 * @param {boolean} expanded - Is the popover expanded
 */

/**
 * @callback onBtnKeyDownFn
 * @param {React.KeyboardEvent} e - The associated event to handle
 * @param {boolean} expanded - Is the popover expanded
 */

/**
 * @param {React.RefObject} popoverAreaRef - The div that will be used as the popover area to focus on when the popover is opened
 * @param {onBtnClickFn} [onBtnClick] - An add-on CB function to the button event handler
 * @param {onBtnKeyDownFn} [onBtnKeyDown] - An add-on CB function to the button event handler
 * @returns {{buttonProps, expanded}}
 */
export const usePopover = (popoverAreaRef, onBtnClick, onBtnKeyDown) => {
  const [expanded, setExpanded] = useState(false);

  const buttonProps = useMemo(() => ({
    onClick: (e) => {
      setExpanded(!expanded)
      if (onBtnClick) {
        e.persist && e.persist();
        onBtnClick(e, expanded);
      }
    },
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        setExpanded(!expanded)
      }
      if (onBtnKeyDown) {
        e.persist && e.persist();
        onBtnKeyDown(e, expanded);
      }
    },
  }), [
    expanded,
    onBtnClick,
    onBtnKeyDown
  ])

  const currentBtnRef = popoverAreaRef && popoverAreaRef.current;

  // Focus the select ref whenever an item is expanded
  useEffect(() => {
    if (currentBtnRef && expanded) {
      currentBtnRef.focus()
    }
  }, [
    expanded,
    currentBtnRef
  ])

  const setExpandedToFalse = useCallback(() => setExpanded(false), []);

  useOutsideClick(popoverAreaRef, expanded, setExpandedToFalse);

  useOutsideFocus(popoverAreaRef, expanded, setExpandedToFalse);

  return {
    buttonProps,
    expanded,
    setExpanded
  }
}
