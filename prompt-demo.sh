#!/bin/bash

echo "🎯 Terminal Prompt Demo"
echo "======================="

# Simple text prompt
echo -n "Enter your name: "
read name
echo "Hello, $name!"
echo

# Password prompt (hidden input)
echo -n "Enter a secret word (hidden): "
read -s secret
echo
echo "Your secret has ${#secret} characters"
echo

# Prompt with default value
read -p "Enter port number [5000]: " port
port=${port:-5000}
echo "Using port: $port"
echo

# Multi-choice prompt
echo "Select your preferred editor:"
echo "1) VS Code"
echo "2) Vim" 
echo "3) Nano"
echo "4) Emacs"
read -p "Enter choice [1-4]: " editor_choice

case $editor_choice in
    1) editor="VS Code";;
    2) editor="Vim";;
    3) editor="Nano";;
    4) editor="Emacs";;
    *) editor="Unknown";;
esac

echo "You selected: $editor"
echo

# Yes/No confirmation
echo -n "Do you want to save these settings? (y/n): "
read -n 1 confirm
echo

if [[ $confirm =~ ^[Yy]$ ]]; then
    echo "✅ Settings saved!"
else
    echo "❌ Settings not saved."
fi

echo
echo "🎉 Demo completed!"

















