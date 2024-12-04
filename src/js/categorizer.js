// URL categorization logic
export async function categorizeURLs(tabDetailsJson) {
  let retryCount = 0;
  const maxRetries = 5;
  
  while (retryCount < maxRetries) {
    try {
      const systemPrompt = `You are a URL categorization expert. Your task is to analyze and categorize the provided URLs and titles into meaningful categories. Follow these guidelines:

1. Primary Categories:
   - News & Media: News websites, magazines, blogs
   - Professional Tools: Email, productivity apps, development tools
   - Social & Communication: Social media, messaging, forums
   - Finance & Business: Banking, investing, business services
   - Shopping & E-commerce: Online stores, marketplaces
   - Travel & Transportation: Airlines, hotels, maps
   - Health & Wellness: Medical, fitness, mental health
   - Education & Learning: Courses, tutorials, academic
   - Entertainment: Streaming, gaming, music
   - Technology: Tech news, software, gadgets
   - Lifestyle: Fashion, food, hobbies
   - Professional: Job boards, networking, career

2. Rules for Categorization:
   - Analyze both URL and title for context
   - Prioritize the most specific category that fits
   - Create new categories if needed for unique cases
   - Each URL should appear only once
   - Consider subdomains and path information

3. Output Format:
   Return a object where:
   - Keys are category names
   - Values are arrays of objects containing URLs and titles
   - Categories should be sorted by number of items
   - URLs within categories should be alphabetically sorted

Please process the following URLs and return the categorized results.`;

      const Session = await ai.languageModel.create({ systemPrompt });
      return await Session.prompt(
        `Please analyze and categorize the following list of open browser tabs.
${JSON.stringify(tabDetailsJson, null, 2)}`
      );
    } catch (error) {
      retryCount++;
      console.error(`Error during categorization (Attempt ${retryCount}/${maxRetries}):`, error);
      if (retryCount === maxRetries) {
        throw new Error("Failed to categorize URLs after 5 attempts. Please try again later.");
      }
      // Wait for a short time before retrying (1 second)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}