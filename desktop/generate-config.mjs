import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { DEFAULT_GAMEPLAY_TUNING, gameplayTuningFields } from '../shared/src/gameplayTuning.ts';

export const configJSON = () => JSON.stringify({ debug: false, ...DEFAULT_GAMEPLAY_TUNING }, null, 2) + '\n';

export function configGuide() {
  const sections = new Map();
  for (const [path, rule] of gameplayTuningFields()) {
    const [section] = path.split('.');
    if (!sections.has(section)) sections.set(section, []);
    const value = rule.kind === 'fleet' ? rule.value.join('、') : rule.value;
    const range = rule.kind === 'fleet' ? '1–40 艘；每项为 warship（战舰）、cargo（货船）或 explorer（探险船）；总数不能超过舰队上限。' :
      `${rule.min}–${rule.max}${rule.integer ? '（整数）' : ''}`;
    sections.get(section).push(`| \`${path}\` | ${rule.description} | ${value} | ${range} |`);
  }
  return `# 欢乐大航海｜配置说明

## 怎么修改

解压整个 ZIP。Windows：编辑与便携版 EXE 同一目录的 \`config.json\`。macOS：编辑与 \`Happy Voyage.app\` 同一目录的文件，不要放进 App 内部。保存后，完全退出并重启游戏。

macOS 首次使用自定义配置前，请在 Finder 中将 **App 本身**移出「下载」目录，放入自己的文件夹，再把 \`config.json\` 放到 App 同目录。若直接从下载位置运行，macOS 可能把 App 放到临时挂载位置，导致游戏找不到原目录中的配置。

这些配置只用于桌面版在本机进行的普通对局和战役。在线房间始终使用服务器规则。下面的数值是本版本默认值；完整默认玩法见 [玩法规则](GAMEPLAY.md)。部分游戏帮助文字也按默认规则编写。

文件必须是 UTF-8 编码的 JSON 对象：键和文字用英文双引号，不可写注释或在最后一项后加逗号。可只保留想修改的字段。文件不存在时不会自动生成，直接使用默认值；若文件读不到或格式无效，游戏会提示并使用默认值。字段类型、键名或数值范围无效时，只忽略相应设置，在控制台警告；互相冲突的设置会回退。删掉或重命名文件可恢复所有默认值。

例如，下列配置让普通对局以 9,999 金币开局，初始舰队改为两艘战舰加一艘货船。战役开局金币由 \`campaign\` 的对应关卡定义。若配置的舰队没有旗舰的同型船，该航海家不会获得专属旗舰。

\`\`\`json
{
  "starting": {
    "gold": 9999,
    "fleet": ["warship", "warship", "cargo"]
  }
}
\`\`\`

## 字段、默认值与有效范围

路径中的点代表下一级对象。概率和比例用小数，例如 0.25 表示 25%。宝藏和风暴的最低值不得超过最高值。

### 桌面测试

| 字段路径 | 说明 | 默认 | 有效范围 |
| --- | --- | --- | --- |
| \`debug\` | 开启桌面版的页面测试功能。改为 \`true\` 并重启后，在主窗口按 **Ctrl+Shift+D**（macOS：**⌘+Shift+D**）打开测试窗口，可选择要测试的场景。省略此字段或设为 \`false\` 时无法打开。 | \`false\` | \`true\` 或 \`false\`，不要加引号 |

${[...sections].map(([section, rows]) => `### ${section}

| 字段路径 | 说明 | 默认 | 有效范围 |
| --- | --- | --- | --- |
${rows.join('\n')}
`).join('\n')}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await Promise.all([
    writeFile(new URL('config.json', import.meta.url), configJSON()),
    writeFile(new URL('../配置说明.md', import.meta.url), configGuide()),
  ]);
}
