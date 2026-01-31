#!/bin/bash

# Script para preparar o projeto iOS e tentar gerar um build de teste
echo "🚀 Iniciando preparação do build iOS de teste..."

cd frontend

# 1. Instalar dependências
echo "📦 Instalando dependências..."
npm install
npm install @capacitor/ios

# 2. Gerar build do site
echo "🏗️ Gerando build do projeto web..."
npm run build

# 3. Adicionar e sincronizar plataforma iOS
echo "🔄 Sincronizando com Capacitor iOS..."
npx cap add ios
npx cap sync ios

echo "✅ Projeto iOS preparado na pasta 'frontend/ios'!"
echo "--------------------------------------------------"
echo "Para gerar o arquivo de teste no Mac, abra o Xcode e use:"
echo "Product > Build"
echo "Ou via linha de comando:"
echo "xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug -sdk iphoneos CODE_SIGNING_ALLOWED=NO"
echo "--------------------------------------------------"
