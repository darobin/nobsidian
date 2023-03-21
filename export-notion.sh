#!/bin/bash

mkdir -p data/export
cd data/export
NOTION_SPACE_ID="fb3fbef6-0b34-462f-b235-627e17f7d72d" \
    NOTION_TOKEN=$(../../echo-notion-token.js) \
    notion-backup
cd -
