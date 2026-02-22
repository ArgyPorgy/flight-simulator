#!/bin/bash
set -e

# Unset NODE_ENV temporarily to ensure devDependencies are installed
unset NODE_ENV
npm install
npm run build
