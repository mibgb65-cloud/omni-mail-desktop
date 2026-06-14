#define MyAppName "OmniMail Desktop"
#define MyAppExeName "OmniMailDesktop.exe"
#define MyAppPublisher "OmniMail"
#ifndef MyAppVersion
#define MyAppVersion "1.0.0"
#endif

[Setup]
AppId={{40379540-704D-4730-9FB4-DD64C2C27FF6}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\OmniMail Desktop
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
AllowNoIcons=yes
OutputDir=..\installer
OutputBaseFilename=OmniMailDesktop-Setup-{#MyAppVersion}
SetupIconFile=icon.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
CloseApplications=yes
RestartApplications=no
UsePreviousAppDir=yes
UsePreviousLanguage=yes
UninstallDisplayIcon={app}\{#MyAppExeName}
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} Setup
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#MyAppVersion}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "chinesesimp"; MessagesFile: "compiler:Default.isl,languages\ChineseSimplified.isl"

[CustomMessages]
english.DataDirPageName=Data storage location
english.DataDirPageDescription=Choose where OmniMail Desktop stores profiles and protected tokens.
english.DataDirPageSubCaption=This folder is preserved when you install an update over the existing version.
english.DataDirRequired=Choose a data storage location.
english.DataDirCreateFailed=Could not create the data storage folder:
chinesesimp.DataDirPageName=数据保存位置
chinesesimp.DataDirPageDescription=选择 OmniMail Desktop 保存配置文件和受保护令牌的位置。
chinesesimp.DataDirPageSubCaption=覆盖安装新版本时，此文件夹会被保留。
chinesesimp.DataDirRequired=请选择数据保存位置。
chinesesimp.DataDirCreateFailed=无法创建数据保存文件夹：

[Files]
Source: "..\bin\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{userdesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
var
  DataDirPage: TInputDirWizardPage;

function GetDefaultDataDir(): string;
var
  StoredDir: string;
begin
  if RegQueryStringValue(HKCU, 'Software\OmniMail\OmniMailDesktop', 'DataDir', StoredDir) and (Trim(StoredDir) <> '') then
  begin
    Result := StoredDir;
  end
  else
  begin
    Result := ExpandConstant('{userappdata}\OmniMailDesktop');
  end;
end;

procedure InitializeWizard();
begin
  DataDirPage := CreateInputDirPage(
    wpSelectDir,
    CustomMessage('DataDirPageName'),
    CustomMessage('DataDirPageDescription'),
    CustomMessage('DataDirPageSubCaption'),
    False,
    ''
  );
  DataDirPage.Add('');
  DataDirPage.Values[0] := GetDefaultDataDir();
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;

  if CurPageID = DataDirPage.ID then
  begin
    if Trim(DataDirPage.Values[0]) = '' then
    begin
      MsgBox(CustomMessage('DataDirRequired'), mbError, MB_OK);
      Result := False;
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssInstall then
  begin
    if not ForceDirectories(DataDirPage.Values[0]) then
    begin
      RaiseException(CustomMessage('DataDirCreateFailed') + #13#10 + DataDirPage.Values[0]);
    end;

    RegWriteStringValue(HKCU, 'Software\OmniMail\OmniMailDesktop', 'DataDir', DataDirPage.Values[0]);
    RegWriteStringValue(HKCU, 'Software\OmniMail\OmniMailDesktop', 'InstallDir', ExpandConstant('{app}'));
    RegWriteStringValue(HKCU, 'Software\OmniMail\OmniMailDesktop', 'Version', '{#MyAppVersion}');
  end;
end;
