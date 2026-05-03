#!/bin/bash
# Script para sincronizar node_modules do container para o host

echo "Copiando node_modules do container..."
docker compose run --rm app sh -c "cp -r /app/node_modules /tmp/nm && tar -czf /tmp/node_modules.tar.gz -C /tmp nm"
docker cp bofullstack-dev:/tmp/node_modules.tar.gz ./node_modules.tar.gz
tar -xzf node_modules.tar.gz
rm node_modules.tar.gz
echo "node_modules sincronizado com sucesso!"
