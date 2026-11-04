import { Plugin } from "@opencode/plugin/tui"

/**
 * Backgrounds whatever long-running shell/tool work is blocking the
 * current session, so the session can continue while it finishes.
 *
 * The actual behavior is OpenCode's built-in `session.background` command.
 * This exposes it as a function: a palette command and a `/background`
 * slash command (aliases: `/bg`). The keyboard shortcut is configured
 * separately in cli.json, because Acode already owns Ctrl+B and Ctrl+Space.
 */
export default Plugin.define({
  id: "local.background-work.tui",
  setup(context) {
    function backgroundRunningWork() {
      const route = context.ui.router.current()
      if (route.type !== "session") {
        context.ui.toast.show({
          message: "Open a session first, then background its running work",
          variant: "warning",
        })
        return
      }
      context.keymap.dispatch("session.background")
    }

    context.keymap.layer(() => ({
      mode: "global",
      priority: 10,
      commands: [
        {
          id: "background.work",
          title: "Background running work",
          description: "Move blocking shell/tool work into the background",
          group: "Session",
          bind: false,
          palette: true,
          slash: { name: "background", aliases: ["bg"] },
          suggested: true,
          run: backgroundRunningWork,
        },
      ],
    }))
  },
})
