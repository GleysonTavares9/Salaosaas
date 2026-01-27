# 🎨 Guia Completo - Splash Screen do Luxe Aura

## ✅ Status Atual da Configuração

### 1. Plugin Instalado
- ✅ `@capacitor/splash-screen@8.0.0` instalado
- ✅ Configurado em `capacitor.config.ts`

### 2. Imagens Geradas
- ✅ **26 variações de splash screen** em todas as densidades
- ✅ Localizadas em `android/app/src/main/res/drawable-*`
- ✅ Imagem base: `resources/splash.png` (872 KB)

### 3. Configuração do Capacitor
```typescript
SplashScreen: {
  launchShowDuration: 3000,        // Mostra por 3 segundos
  launchAutoHide: true,             // Esconde automaticamente
  launchFadeOutDuration: 500,       // Fade out de 500ms
  backgroundColor: "#08090a",       // Fundo preto
  androidSplashResourceName: "splash",
  androidScaleType: "CENTER_CROP",
  showSpinner: false,               // Sem spinner
  splashFullScreen: true,           // Tela cheia
  splashImmersive: true            // Modo imersivo
}
```

### 4. Controle no React
- ✅ `SplashScreen.hide()` chamado após carregar dados
- ✅ Localizado em `App.tsx` linha 112

## 🚀 Como Garantir que o Splash Apareça

### Passo 1: Rebuild Completo
```powershell
# 1. Build do projeto React
npm run build

# 2. Sincronizar com Android
npx cap sync android

# 3. Abrir no Android Studio
npx cap open android
```

### Passo 2: No Android Studio

#### A) Limpar Build Anterior
1. **Build** → **Clean Project**
2. Aguarde a limpeza terminar

#### B) Rebuild
1. **Build** → **Rebuild Project**
2. Aguarde a compilação

#### C) Gerar APK
1. **Build** → **Build Bundle(s) / APK(s)** → **Build APK**
2. Aguarde o build terminar
3. Clique em **locate** para encontrar o APK

### Passo 3: Instalar e Testar

#### Instalação
```powershell
# Via ADB (se o celular estiver conectado)
adb install -r caminho\para\app-debug.apk

# OU copie o APK para o celular e instale manualmente
```

#### Teste
1. **Desinstale** o app antigo do celular (se existir)
2. **Instale** o novo APK
3. **Abra** o app
4. **Observe**: Deve aparecer o splash com o logo "LA" dourado

## 🐛 Troubleshooting

### Problema: Splash não aparece

#### Solução 1: Verificar se o plugin está sincronizado
```powershell
npx cap sync android
```

#### Solução 2: Verificar MainActivity.java
O arquivo `android/app/src/main/java/.../MainActivity.java` deve ter:
```java
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {}
```

#### Solução 3: Verificar styles.xml
O arquivo `android/app/src/main/res/values/styles.xml` deve ter:
```xml
<item name="android:windowBackground">@drawable/splash</item>
```

#### Solução 4: Rebuild completo
1. Feche o Android Studio
2. Delete a pasta `android/build`
3. Delete a pasta `android/app/build`
4. Reabra o Android Studio
5. Build → Rebuild Project

### Problema: Splash aparece mas não some

#### Causa: `SplashScreen.hide()` não está sendo chamado

#### Solução: Verificar App.tsx
Certifique-se de que a linha 112 tem:
```typescript
SplashScreen.hide();
```

E que está dentro do bloco `finally` após carregar os salões.

### Problema: Splash aparece branco/vazio

#### Causa: Imagens não foram geradas corretamente

#### Solução: Regenerar assets
```powershell
npx @capacitor/assets generate --android
npx cap sync android
```

## 📱 Comportamento Esperado

### Ao Abrir o App:
1. **0s**: Splash screen aparece (logo LA dourado)
2. **0-3s**: Splash fica visível enquanto carrega
3. **3s**: Fade out suave (500ms)
4. **3.5s**: App mostra conteúdo carregado

### Fluxo Completo:
```
Usuário toca no ícone
    ↓
Splash Screen Nativo aparece (fundo preto + logo LA)
    ↓
React carrega em background
    ↓
Dados são buscados (salões + localização)
    ↓
SplashScreen.hide() é chamado
    ↓
Fade out suave
    ↓
App mostra tela inicial
```

## ✅ Checklist Final

Antes de gerar o APK, verifique:

- [ ] `npm run build` executado com sucesso
- [ ] `npx cap sync android` executado
- [ ] Imagens em `android/app/src/main/res/drawable-*` existem
- [ ] `capacitor.config.ts` tem configuração do SplashScreen
- [ ] `App.tsx` importa e usa `SplashScreen.hide()`
- [ ] Android Studio sem erros de compilação
- [ ] APK gerado com sucesso

## 🎨 Customização Futura

Se quiser alterar o splash:

1. Edite `resources/splash.png`
2. Execute `npx @capacitor/assets generate --android`
3. Execute `npx cap sync android`
4. Rebuild no Android Studio

---

**Nota:** O splash screen é uma funcionalidade NATIVA do Android. Ele aparece ANTES do React carregar, por isso é importante que as imagens estejam corretas no projeto Android.
