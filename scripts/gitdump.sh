#!/bin/bash

# Notebook Navigator - Plugin for Obsidian
# Copyright (c) 2025-2026 Johan Sanneblad
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to project root directory
cd "$SCRIPT_DIR/.."

# Get timestamp in format YYYYMMDD-HHMMSS
timestamp=$(date +"%Y%m%d-%H%M%S")

# Get current directory name only (not full path)
folder_name=$(basename "$PWD")

# Show selection menu
echo "Choose diff type:"
echo "1) Uncommitted changes (staged and unstaged)"
echo "2) Current branch vs main branch"
echo "3) Current state vs before specific commit"
read -p "Enter choice (1, 2, or 3): " choice

case $choice in
    1)
        # Set output path in parent folder
        output_file="../${folder_name}_uncommitted_${timestamp}.txt"
        
        # Write diffs to the file
        echo "Unstaged changes:" > "$output_file"
        git diff --patch --minimal >> "$output_file"
        
        echo "" >> "$output_file"
        echo "Staged (but not yet committed) changes:" >> "$output_file"
        git diff --cached --patch --minimal >> "$output_file"
        ;;
    2)
        # Set output path in parent folder
        output_file="../${folder_name}_vs_main_${timestamp}.txt"
        
        # Get current branch name
        current_branch=$(git branch --show-current)
        
        # Write diff to the file
        echo "Diff between '$current_branch' and 'main' branch:" > "$output_file"
        git diff main..HEAD --patch --minimal >> "$output_file"
        ;;
    3)
        # Ask for commit ID
        read -p "Enter commit ID (e.g., ef3f29a): " commit_id
        
        # Validate commit exists
        if ! git rev-parse --verify "$commit_id" > /dev/null 2>&1; then
            echo "Error: Commit '$commit_id' not found."
            exit 1
        fi
        
        # Set output path in parent folder
        output_file="../${folder_name}_vs_before_${commit_id}_${timestamp}.txt"
        
        # Get the parent commit (the state before the specified commit)
        parent_commit="${commit_id}^"
        
        # Write diff to the file
        echo "Diff between current state and before commit '$commit_id':" > "$output_file"
        echo "Comparing HEAD with ${parent_commit}" >> "$output_file"
        echo "" >> "$output_file"
        git diff "${parent_commit}..HEAD" --patch --minimal >> "$output_file"
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

echo "All diffs saved to $output_file"