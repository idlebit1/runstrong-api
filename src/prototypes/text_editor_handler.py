import json
import re
from pathlib import Path
from typing import Dict, Any, List, Tuple

class TextEditorHandler:
    """
    Implements Anthropic's built‑in `text_editor` tool for Bedrock Agents.

    Supported commands:
      • view          {path, view_range?}
      • str_replace   {path, old_str, new_str, count?}
      • insert_line   {path, line_num, text}
      • delete_line   {path, line_num}
      • create    {path, text}                    (create / overwrite)

    All paths are **sandbox‑relative** to `root_path`.
    Line numbers are 1‑indexed (Anthropic convention).
    """

    def __init__(
        self,
        root_path: str,
        max_tokens: int = 200_000,
        safety_margin: int = 4_000,
    ):
        self.root = Path(root_path).resolve()
        self.max_tokens = max_tokens
        self.safety_margin = safety_margin
        self.tokenizer = _simple_word_tokenizer   # drop‑in; swap for real one

    # --------------------------------------------------------------------- #
    # public API
    # --------------------------------------------------------------------- #
    def handle(self, tool_use: Dict[str, Any]) -> Dict[str, Any]:
        try:
            cmd = tool_use["input"]["command"]
        except KeyError:
            print("error in tool_use input:", json.dumps(tool_use["input"], indent=2))
            return _error(tool_use, "missing command in tool_use input")
        fn = getattr(self, f"_cmd_{cmd}", None)
        if fn is None:
            return _error(tool_use, f"unsupported command: {cmd}")
        try:
            body = fn(tool_use["input"])
            return _ok(tool_use, body)
        except Exception as e:
            return _error(tool_use, str(e))

    # --------------------------------------------------------------------- #
    # individual command handlers
    # --------------------------------------------------------------------- #
    def _cmd_view(self, args: Dict[str, Any]) -> str:
        path = self._safe_path(args["path"])
        view_range = args.get("view_range")          # [start, end] (1‑indexed)
        # print("path:    ", path)
        if path.is_dir():
            files = [f.name for f in path.iterdir()]
            message = "Directory listing:\n" + "\n".join(files)
            # print(message)
            return message
        text = path.read_text(encoding="utf‑8")

        # long‑file safeguard ------------------------------------------------
        tokens = self.tokenizer(text)
        if tokens > self.max_tokens - self.safety_margin and not view_range:
            # default to first 400 lines if caller didn’t pick a slice
            view_range = [1, 400]

        if view_range:
            start, end = _normalize_range(view_range)
            lines = text.splitlines()
            snippet = lines[start - 1 : end] if end != -1 else lines[start - 1 :]
            header = (
                f"# showing lines {start}-{start+len(snippet)-1} "
                f"of {len(lines)} (file truncated)\n"
            )
            return header + "\n".join(
                _with_line_numbers(snippet, start)
            )
        else:
            return _with_line_numbers(text.splitlines(), 1)

    def _cmd_str_replace(self, args: Dict[str, Any]) -> str:
        path = self._safe_path(args["path"])
        old = args["old_str"]
        new = args["new_str"]
        
        text = path.read_text(encoding="utf‑8")
        # print("foobar")
        # print("old:", old)
        # print("new:", new)
        # print(repr(text))
        
        count = text.count(old)
        if count == 0:
            return "X no replacements made; string not found"
        elif count > 1:
            return "X multiple matches found; aborting to avoid ambiguity"
        else:
            text = text.replace(old, new, 1)   
            path.write_text(text, encoding="utf‑8")
            return f"✔︎ 1 replacement made"

    def _cmd_insert_line(self, args: Dict[str, Any]) -> str:
        path = self._safe_path(args["path"])
        n   = args["line_num"]
        txt = args["text"]

        lines = path.read_text(encoding="utf‑8").splitlines()
        if n < 1 or n > len(lines) + 1:
            raise IndexError("line_num out of range")
        lines.insert(n - 1, txt)
        path.write_text("\n".join(lines) + "\n", encoding="utf‑8")
        return f"✔︎ inserted at line {n}"

    def _cmd_delete_line(self, args: Dict[str, Any]) -> str:
        path = self._safe_path(args["path"])
        n = args["line_num"]

        lines = path.read_text(encoding="utf‑8").splitlines()
        if n < 1 or n > len(lines):
            raise IndexError("line_num out of range")
        deleted = lines.pop(n - 1)
        path.write_text("\n".join(lines) + "\n", encoding="utf‑8")
        return f"✔︎ deleted line {n}: {deleted[:40]}..."

    def _cmd_create(self, args: Dict[str, Any]) -> str:
        # print("Creating file with args:", args)
        path = self._safe_path(args["path"])
        text = args["file_text"]
        # print()
        # print("Creating file at:", path)
        # print("With content:", text)
        # print()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf‑8")
        return "✔︎ file written"

    # --------------------------------------------------------------------- #
    # helpers
    # --------------------------------------------------------------------- #
    def _safe_path(self, p: str) -> Path:
        """Prevent directory traversal outside the sandbox."""
        q = (self.root / p.lstrip("/")).resolve()
        if not str(q).startswith(str(self.root)):
            raise ValueError("path escapes sandbox")
        return q

# ------------------------------------------------------------------------- #
# utility functions
# ------------------------------------------------------------------------- #
def _with_line_numbers(lines: List[str], start: int) -> str:
    width = len(str(start + len(lines) - 1))
    return "\n".join(f"{i:{width}d}| {line}" for i, line in enumerate(lines, start))

def _normalize_range(r: List[int]) -> Tuple[int, int]:
    if len(r) != 2:
        raise ValueError("view_range must be [start, end]")
    start, end = r
    if start < 1:
        raise ValueError("start must be ≥1")
    return start, end

def _simple_word_tokenizer(text: str) -> int:
    """Cheap placeholder; swap out for tiktoken or anthropic‑tokens."""
    return len(text.split())

def _ok(tool_use: Dict[str, Any], body: str) -> Dict[str, Any]:
    return {
        "type": "tool_result",
        "tool_use_id": tool_use["id"],
        "content": body,
    }

def _error(tool_use: Dict[str, Any], msg: str) -> Dict[str, Any]:
    return {
        "type": "tool_result",
        "tool_use_id": tool_use["id"],
        "content": f"ERROR: {msg}",
    }
