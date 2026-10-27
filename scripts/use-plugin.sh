#!/usr/bin/env bash
# Switch the host's backend to a plugin build and restart it.
#
#   scripts/use-plugin.sh <plugin>    publish the plugin repo's current checkout
#   scripts/use-plugin.sh --develop   put every plugin back on its develop branch
#
# <plugin> is a path to the plugin repo, or a name such as "voucher" or
# "medusa-voucher" for the repo next to this one (../medusa-voucher).
#
# Each plugin: `medusa plugin:publish` in its repo, then here `medusa plugin:add`.
# Then once: undo the pnpm-lock.yaml change plugin:add makes, `medusa db:migrate`,
# delete node_modules/.vite (or the admin serves the old plugin UI), stop
# whatever holds port 9000, start `medusa develop` in the background and wait
# until /health answers. The log goes to $BACKEND_LOG.

set -euo pipefail

HOST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$HOST_DIR/apps/backend"
PLUGINS_DIR="$(dirname "$HOST_DIR")"
PORT=9000
BACKEND_LOG="${BACKEND_LOG:-${TMPDIR:-/tmp}/medusa-dev-host-backend.log}"
READY_TIMEOUT=300

die() {
  echo "error: $*" >&2
  exit 1
}

usage() {
  sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

check_node() {
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$major" -ge 22 ] || die "Node 22+ is needed, found $(node -v). Switch first, e.g. 'nvm use 24'."
}

# Path of a plugin repo from a path or a name.
resolve_repo() {
  local arg="$1"
  if [ -d "$arg" ]; then
    (cd "$arg" && pwd)
  elif [ -d "$PLUGINS_DIR/$arg" ]; then
    echo "$PLUGINS_DIR/$arg"
  elif [ -d "$PLUGINS_DIR/medusa-$arg" ]; then
    echo "$PLUGINS_DIR/medusa-$arg"
  else
    die "no plugin repo at '$arg', '$PLUGINS_DIR/$arg' or '$PLUGINS_DIR/medusa-$arg'"
  fi
}

package_name() {
  node -p "require('$1/package.json').name"
}

# Plugins the host has installed from yalc.
installed_plugins() {
  node -e '
    const pkg = require(process.argv[1])
    for (const [name, spec] of Object.entries(pkg.dependencies ?? {})) {
      if (String(spec).startsWith("file:.yalc/")) console.log(name)
    }
  ' "$BACKEND_DIR/package.json"
}

# Repo of an installed plugin: @khumkha/medusa-voucher -> ../medusa-voucher.
repo_of_package() {
  local dir="$PLUGINS_DIR/${1##*/}"
  [ -d "$dir" ] || die "no repo for $1 at $dir"
  echo "$dir"
}

refuse_if_plugin_develop_running() {
  if pgrep -f "medusa plugin:develop" >/dev/null 2>&1; then
    die "'medusa plugin:develop' is running. Stop it first: only one plugin may target the host at a time."
  fi
}

publish_and_add() {
  local repo="$1" name
  name="$(package_name "$repo")"
  echo "==> $name: plugin:publish in $repo"
  (cd "$repo" && pnpm medusa plugin:publish)
  echo "==> $name: plugin:add"
  (cd "$BACKEND_DIR" && npx medusa plugin:add "$name")
}

# Stops this host's `medusa develop` watchers as well as whatever listens on the
# port: stopping only the server leaves the watcher, which starts it again.
# Case-insensitive because macOS paths match either way and the watcher may
# have been started from a differently-cased path.
stop_backend() {
  local pids
  pids="$(
    {
      pgrep -if "$BACKEND_DIR/node_modules/.bin/../@medusajs/cli/cli.js develop" || true
      lsof -ti "tcp:$PORT" -sTCP:LISTEN || true
    } | sort -u | tr '\n' ' '
  )"
  [ -z "${pids// /}" ] && return
  echo "==> stopping the backend ($pids)"
  # shellcheck disable=SC2086
  kill $pids 2>/dev/null || true
  for _ in $(seq 1 20); do
    lsof -ti "tcp:$PORT" -sTCP:LISTEN >/dev/null || return 0
    sleep 0.5
  done
  # shellcheck disable=SC2086
  kill -9 $pids $(lsof -ti "tcp:$PORT" -sTCP:LISTEN) 2>/dev/null || true
}

start_backend() {
  echo "==> starting medusa develop (log: $BACKEND_LOG)"
  # exec, with every stream redirected, so nothing is left holding this
  # script's output open after it exits.
  (cd "$BACKEND_DIR" && exec nohup npx medusa develop </dev/null >"$BACKEND_LOG" 2>&1) &
  local waited=0
  until curl -sf "http://localhost:$PORT/health" >/dev/null; do
    sleep 2
    waited=$((waited + 2))
    if [ "$waited" -ge "$READY_TIMEOUT" ]; then
      tail -n 30 "$BACKEND_LOG" >&2
      die "the backend did not answer on port $PORT within ${READY_TIMEOUT}s"
    fi
  done
  echo "==> backend ready at http://localhost:$PORT (admin: /app)"
}

# What the host now runs, per plugin.
report() {
  local name repo version state
  echo
  echo "Plugins on the host:"
  for name in $(installed_plugins); do
    repo="$(repo_of_package "$name")"
    version="$(node -p "require('$BACKEND_DIR/.yalc/$name/package.json').version")"
    state=""
    [ -n "$(git -C "$repo" status --porcelain)" ] && state=" (uncommitted changes)"
    echo "  $name $version  $(git -C "$repo" branch --show-current) @ $(git -C "$repo" rev-parse --short HEAD)$state"
  done
  echo
  echo "Hard reload the admin in the browser and log in again."
}

finish() {
  echo "==> restoring pnpm-lock.yaml"
  git -C "$HOST_DIR" checkout -- pnpm-lock.yaml
  echo "==> db:migrate"
  (cd "$BACKEND_DIR" && npx medusa db:migrate)
  rm -rf "$BACKEND_DIR/node_modules/.vite"
  stop_backend
  start_backend
  report
}

[ $# -eq 1 ] || usage
check_node
refuse_if_plugin_develop_running

if [ "$1" = "--develop" ]; then
  for name in $(installed_plugins); do
    repo="$(repo_of_package "$name")"
    if [ -n "$(git -C "$repo" status --porcelain)" ]; then
      die "$repo has uncommitted changes; commit or stash them before switching it to develop"
    fi
  done
  for name in $(installed_plugins); do
    repo="$(repo_of_package "$name")"
    echo "==> $name: checkout develop"
    git -C "$repo" checkout develop
    publish_and_add "$repo"
  done
else
  case "$1" in -*) usage ;; esac
  publish_and_add "$(resolve_repo "$1")"
fi

finish
