"""Markdown code block extraction utilities"""

import re
from typing import Optional


def strip_markdown_code_blocks(text: str) -> str:
    """
    Strip markdown code blocks from contract code

    Handles cases where code blocks weren't properly extracted earlier in the pipeline.
    Supports multiple formats:
    - ```solidity\n...code...\n```
    - ```\n...code...\n```
    - Unclosed code blocks

    Args:
        text: Contract code that may contain markdown formatting

    Returns:
        Clean Solidity code without markdown
    """
    if not text:
        return ""

    text = text.strip()

    # Try to extract from ```solidity code blocks (with closing ```)
    solidity_pattern = r"```solidity\s*\n(.*?)```"
    match = re.search(solidity_pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()

    # Try to extract from ```solidity code blocks (without closing ``` - unclosed block)
    unclosed_solidity_pattern = r"```solidity\s*\n(.*?)$"
    match = re.search(unclosed_solidity_pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()

    # Try to extract from generic ``` code blocks (with closing ```)
    generic_pattern = r"```[a-z]*\s*\n(.*?)```"
    match = re.search(generic_pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()

    # Try to extract from generic ``` code blocks (without closing ```)
    unclosed_generic_pattern = r"```[a-z]*\s*\n(.*?)$"
    match = re.search(unclosed_generic_pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()

    # If code starts with ```, try to remove it manually
    if text.startswith("```"):
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1 :]
            text = text.rstrip("`").strip()
            return text

    # If no code blocks found, return as-is (might be plain code)
    return text.strip()


def extract_solidity_code(text: str) -> str:
    """
    Extract Solidity code from markdown code blocks

    Alias for strip_markdown_code_blocks for backward compatibility
    """
    return strip_markdown_code_blocks(text)

