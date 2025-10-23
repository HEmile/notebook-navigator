
[Notebook Navigator](https://notebooknavigator.com/) is a plugin for [Obsidian](https://obsidian.md) that replaces the default file explorer with a Notes-style interface with a dual-pane layout.

**This fork adds support for navigating topics using typed links.** 
It is quite specific [to my setup](https://www.emilevankrieken.com/blog/2025/academic-obsidian/).
It is functional, but it is also vibe-coded in a day, so no idea how production ready it is. 
If you are interested on how to structure your notes to make use of this feature, and some examples, please read [this tutorial](https://www.emilevankrieken.com/blog/2025/academic-obsidian/). 

## Merge from upstream
It is apparently a bad idea to rebase from base/usptream. Best steps:
- Create new branch
- Use Github to create pull request from base into that new branch
- Use `git pull https://github.com/johansan/notebook-navigator.git main --no-rebase`
- Checkout new branch, then `git merge --no-ff johansan-main`
- Git push
