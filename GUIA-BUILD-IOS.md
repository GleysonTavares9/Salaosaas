# Guia: Compilar iOS com GitHub Actions

Este guia explica como configurar a compilação automática do app iOS usando GitHub Actions (macOS runner gratuito).

## 📋 Pré-requisitos

Você vai precisar de uma **conta Apple Developer** (US$ 99/ano) para:
1. Criar certificados de assinatura
2. Criar provisioning profiles
3. Registrar o App ID

## 🔐 Passo 1: Criar Certificados e Profiles (no Mac ou Xcode Cloud)

### Opção A: Usando um Mac
1. Abra o **Keychain Access** no Mac
2. Menu: **Keychain Access > Certificate Assistant > Request a Certificate from a Certificate Authority**
3. Preencha seu email e nome, salve o arquivo `.certSigningRequest`
4. Acesse [Apple Developer Portal](https://developer.apple.com/account/resources/certificates/list)
5. Crie um novo certificado:
   - **Development**: Para testes
   - **Distribution**: Para App Store
6. Faça upload do `.certSigningRequest` e baixe o certificado
7. Instale o certificado no Keychain
8. Exporte o certificado como `.p12`:
   - Clique com botão direito no certificado
   - Export > Escolha formato `.p12`
   - Defina uma senha (você vai precisar dela)

### Opção B: Usando Xcode automaticamente
1. Abra o projeto iOS no Xcode
2. Vá em **Signing & Capabilities**
3. Marque **Automatically manage signing**
4. Selecione seu Team
5. Xcode vai criar tudo automaticamente

## 📦 Passo 2: Criar Provisioning Profile

1. Acesse [Provisioning Profiles](https://developer.apple.com/account/resources/profiles/list)
2. Clique em **+** para criar novo
3. Escolha o tipo:
   - **iOS App Development**: Para testes
   - **App Store**: Para publicação
4. Selecione o App ID: `com.luxeaura.app`
5. Selecione o certificado criado anteriormente
6. Selecione os dispositivos (apenas para Development)
7. Baixe o arquivo `.mobileprovision`

## 🔑 Passo 3: Configurar Secrets no GitHub

1. Acesse seu repositório no GitHub
2. Vá em **Settings > Secrets and variables > Actions**
3. Clique em **New repository secret** e adicione:

### Secret 1: BUILD_CERTIFICATE_BASE64
```bash
# No Mac ou Linux, converta o .p12 para base64:
base64 -i Certificates.p12 | pbcopy
# Cole o resultado no GitHub Secret
```

### Secret 2: P12_PASSWORD
```
A senha que você definiu ao exportar o .p12
```

### Secret 3: BUILD_PROVISION_PROFILE_BASE64
```bash
# Converta o .mobileprovision para base64:
base64 -i profile.mobileprovision | pbcopy
# Cole o resultado no GitHub Secret
```

### Secret 4: KEYCHAIN_PASSWORD
```
Qualquer senha forte (será usada temporariamente no runner)
Exemplo: MySecurePassword123!
```

## ⚙️ Passo 4: Configurar o ExportOptions.plist

Edite o arquivo `frontend/ios/App/ExportOptions.plist`:

1. **YOUR_TEAM_ID**: Encontre em [Membership](https://developer.apple.com/account/#/membership/)
   - Exemplo: `A1B2C3D4E5`

2. **YOUR_PROVISIONING_PROFILE_NAME**: Nome exato do provisioning profile
   - Exemplo: `Luxe Aura Development`

## 🚀 Passo 5: Executar o Build

1. Vá até **Actions** no GitHub
2. Selecione **Build iOS App**
3. Clique em **Run workflow**
4. Escolha o tipo de build:
   - `development`: Para testes em dispositivos registrados
   - `adhoc`: Para distribuição ad-hoc
   - `appstore`: Para enviar à App Store
5. Clique em **Run workflow**

O GitHub vai:
- Usar um Mac virtual (grátis, 2000 minutos/mês)
- Instalar dependências
- Compilar o app
- Gerar o arquivo `.ipa`

## 📥 Passo 6: Baixar o IPA

1. Quando o workflow terminar, clique nele
2. Na seção **Artifacts**, baixe o arquivo `ios-app-[tipo]`
3. Descompacte o `.zip` para obter o `.ipa`

## 📱 Passo 7: Instalar no iPhone

### Para Development/AdHoc:
1. Use o **Apple Configurator** (Mac)
2. Ou envie via **TestFlight** (recomendado)

### Para App Store:
1. Use o **Transporter** app (Mac)
2. Ou `xcrun altool` via terminal
3. Ou faça upload direto no [App Store Connect](https://appstoreconnect.apple.com)

## 💡 Dicas

- **Limite gratuito**: 2000 minutos/mês de macOS runner
- **Tempo de build**: ~10-15 minutos por compilação
- **Cache**: O workflow usa cache do npm para acelerar
- **Renovação**: Certificados expiram em 1 ano, provisioning profiles podem variar

## 🆘 Troubleshooting

### Erro: "No signing certificate"
- Verifique se o certificado está em base64 correto
- Confirme que a senha do P12 está correta

### Erro: "Provisioning profile doesn't match"
- Verifique o Bundle ID no Xcode: deve ser `com.luxeaura.app`
- Confirme que o provisioning profile é para o mesmo App ID

### Erro: "Team ID not found"
- Verifique o Team ID no Apple Developer Portal
- Atualize o `ExportOptions.plist`

## 📚 Recursos

- [GitHub Actions - macOS runners](https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners#supported-runners-and-hardware-resources)
- [Apple Developer Portal](https://developer.apple.com/account/)
- [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)
