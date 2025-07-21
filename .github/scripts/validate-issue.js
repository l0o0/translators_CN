/**
 * 校验Issue标题和标签，确定对应的模板类型
 * @param {string} title - Issue标题
 * @param {Array} labels - Issue标签数组
 * @returns {Object} 校验结果
 */
function validateIssueTitle(title, labels) {
  // 检查是否来自模板
  const isFromTemplate = labels.some(label => 
    typeof label === 'string' ? label === 'from template' : label.name === 'from template'
  );

  if (!isFromTemplate) {
    return {
      isValid: true,
      shouldContinue: false,
      template: '',
      message: 'This issue does not use a template, skipping validation.'
    };
  }

  // 验证标题格式
  const titleRegex = /^\[(New|Bug|Enhancement)\]:\s/;
  if (!titleRegex.test(title)) {
    return {
      isValid: false,
      shouldContinue: false,
      template: '',
      message: 'Title format is invalid. Expected format: [New|Bug|Enhancement]: description'
    };
  }

  // 确定模板类型
  const templateMapping = {
    'bug': 'T1_bug.yaml',
    'enhancement': 'T2_enhancement.yaml',
    'new translator': 'T3_new_translator.yaml'
  };

  const template = labels
    .map(label => typeof label === 'string' ? label : label.name)
    .find(labelName => templateMapping[labelName]);

  if (!template) {
    return {
      isValid: true,
      shouldContinue: false,
      template: '',
      message: 'This issue does not use a recognized template, skipping validation.'
    };
  }

  return {
    isValid: true,
    shouldContinue: true,
    template: templateMapping[template],
    message: `Template identified: ${templateMapping[template]}`
  };
}

// 设置 GitHub Actions 输出变量的辅助函数
async function setOutput(name, value) {
  const fs = await import('fs');
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `${name}=${value}\n`);
  }
}

// 主执行函数
async function main() {
  const title = process.argv[2];
  const labelsJson = process.argv[3];
  
  if (!title || !labelsJson) {
    console.error('Usage: node validate-issue.js "<title>" "<labels_json>"');
    process.exit(1);
  }

  try {
    const labels = JSON.parse(labelsJson);
    const result = validateIssueTitle(title, labels);
    
    console.log(result.message);
    
    // 设置 GitHub Actions 输出变量
    await setOutput('should-continue', result.shouldContinue);
    await setOutput('template', result.template);
    
    // 如果标题无效，使用 gh CLI 关闭 issue
    if (!result.isValid) {
      const { execSync } = await import('child_process');
      const fs = await import('fs');
      const issueNumber = process.env.GITHUB_EVENT_PATH ? 
        JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).issue.number : 
        null;
      
      if (issueNumber) {
        try {
          execSync(`gh issue edit ${issueNumber} --add-label invalid`, { stdio: 'inherit' });
          execSync(`gh issue close ${issueNumber} --comment "由于标题不符合要求，已自动关闭 issue。\n${result.message}" --reason "completed"`, { stdio: 'inherit' });
        } catch (error) {
          console.error('Failed to close issue:', error.message);
        }
      }
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error parsing labels JSON:', error.message);
    process.exit(1);
  }
}

// 如果作为脚本直接运行，执行主函数
if (process.argv.length > 2) {
  main();
}

export { validateIssueTitle };