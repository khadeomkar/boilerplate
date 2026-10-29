import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // load nav as fragment
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  // decorate nav DOM
  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  const classes = ['brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  const navBrand = nav.querySelector('.nav-brand');
  const brandLink = navBrand.querySelector('.button');
  if (brandLink) {
    brandLink.className = '';
    brandLink.closest('.button-container').className = '';
  }

  // Create sidebar structure with logo
  const aside = document.createElement('aside');
  aside.className = 'sidebar';
  const sidebarTop = document.createElement('div');
  sidebarTop.className = 'sidebar-top';
  
  // Move only the picture tag into sidebar-top
  if (navBrand) {
    const picture = navBrand.querySelector('picture');
    if (picture) {
      sidebarTop.append(picture);
    }
  }
  
  aside.append(sidebarTop);

  // Create divider after logo
  const divider = document.createElement('div');
  divider.className = 'sidebar-divider';
  aside.append(divider);

  // Create simplified nav structure
  const navSection = document.createElement('div');
  navSection.className = 'nav-section';
  
  const navList = document.createElement('ul');
  navList.className = 'nav-list';
  navList.id = 'nav-list';
  
  // Get current page URL for active state
  const currentPath = window.location.pathname;
  
  // Get nav sections and create nav items - include ALL authored links
  const navSections = nav.querySelector('.nav-sections');
  
  if (navSections) {
    // Get all links from the navigation, including nested ones
    const allLinks = navSections.querySelectorAll('a');
    
    if (allLinks.length === 0) {
      // If no links found, try to get all list items
      const listItems = navSections.querySelectorAll('li');
      
      listItems.forEach((item) => {
        const navItem = document.createElement('li');
        navItem.className = 'nav-item';
        
        const navLink = document.createElement('a');
        navLink.className = 'nav-link';
        
        // Get text content from list item
        const textContent = item.textContent.trim();
        navLink.textContent = textContent;
        
        // Check if there's a link inside
        const link = item.querySelector('a');
        if (link) {
          const href = link.getAttribute('href') || '';
          if (href) {
            navLink.setAttribute('href', href);
          }
          const pageName = href.split('/').pop().replace('.html', '') || textContent.toLowerCase().replace(/\s+/g, '');
          navLink.setAttribute('data-page', pageName);
          
          // Check if this link matches the current page
          if (href === currentPath || currentPath.endsWith(href)) {
            navLink.classList.add('active');
          }
        }
        
        navItem.appendChild(navLink);
        navList.appendChild(navItem);
      });
    } else {
      allLinks.forEach((link) => {
        const navItem = document.createElement('li');
        navItem.className = 'nav-item';
        
        const navLink = document.createElement('a');
        navLink.className = 'nav-link';
        
        // Copy href if exists
        const href = link.getAttribute('href') || '';
        if (href) {
          navLink.setAttribute('href', href);
        }
        
        // Extract page name from href or use text content
        const pageName = href.split('/').pop().replace('.html', '') || link.textContent.toLowerCase().replace(/\s+/g, '');
        navLink.setAttribute('data-page', pageName);
        navLink.textContent = link.textContent.trim();
        
        // Check if this link matches the current page
        if (href === currentPath || currentPath.endsWith(href) || (href !== '' && currentPath.includes(href))) {
          navLink.classList.add('active');
        }
        
        navItem.appendChild(navLink);
        navList.appendChild(navItem);
      });
    }
  } else {
    // Try to find links directly in nav
    const directLinks = nav.querySelectorAll('a');
    
    directLinks.forEach((link) => {
      const navItem = document.createElement('li');
      navItem.className = 'nav-item';
      
      const navLink = document.createElement('a');
      navLink.className = 'nav-link';
      
      // Copy href if exists
      const href = link.getAttribute('href') || '';
      if (href) {
        navLink.setAttribute('href', href);
      }
      
      // Extract page name from href or use text content
      const pageName = href.split('/').pop().replace('.html', '') || link.textContent.toLowerCase().replace(/\s+/g, '');
      navLink.setAttribute('data-page', pageName);
      navLink.textContent = link.textContent.trim();
      
      // Check if this link matches the current page
      if (href === currentPath || currentPath.endsWith(href) || (href !== '' && currentPath.includes(href))) {
        navLink.classList.add('active');
      }
      
      navItem.appendChild(navLink);
      navList.appendChild(navItem);
    });
  }
  
  navSection.appendChild(navList);
  aside.append(navSection);

  // Process Quick Links section (3rd section)
  const navTools = nav.querySelector('.nav-tools');
  
  if (navTools) {
    // Create divider before quick links
    const quickLinksDivider = document.createElement('div');
    quickLinksDivider.className = 'sidebar-divider';
    aside.append(quickLinksDivider);

    // Create quick links section
    const quickLinksSection = document.createElement('div');
    quickLinksSection.className = 'quick-links-section';
    
    // Get the section title (if any)
    const sectionTitle = navTools.querySelector('h1, h2, h3, h4, h5, h6, p:first-child, strong');
    if (sectionTitle) {
      const titleElement = document.createElement('h3');
      titleElement.className = 'quick-links-label';
      titleElement.textContent = sectionTitle.textContent.trim();
      quickLinksSection.appendChild(titleElement);
    }
    
    // Create quick links list
    const quickLinksList = document.createElement('ul');
    quickLinksList.className = 'quick-links-list';
    
    // Get all links from the tools section
    const toolLinks = navTools.querySelectorAll('a');
    
    toolLinks.forEach((link) => {
      const quickLinkItem = document.createElement('li');
      quickLinkItem.className = 'quick-link-item';
      
      const quickLink = document.createElement('a');
      quickLink.className = 'quick-link';
      
      const href = link.getAttribute('href') || '';
      if (href) {
        quickLink.setAttribute('href', href);
      }
      
      quickLink.textContent = link.textContent.trim();
      
      quickLinkItem.appendChild(quickLink);
      quickLinksList.appendChild(quickLinkItem);
    });
    
    quickLinksSection.appendChild(quickLinksList);
    aside.append(quickLinksSection);
  }

  // Create user section at the bottom
  const userSection = document.createElement('div');
  userSection.className = 'sidebar-user';
  
  // Create avatar
  const avatar = document.createElement('div');
  avatar.className = 'avatar-icon';
  
  // Add avatar image or initials
  const avatarImg = document.createElement('img');
  avatarImg.src = 'https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/user-round.svg';
  avatarImg.alt = 'User Avatar';
  avatar.appendChild(avatarImg);
  
  // Create user info container
  const userInfo = document.createElement('div');
  userInfo.className = 'user-info';
  
  // Create name element
  const userName = document.createElement('div');
  userName.className = 'name';
  userName.textContent = 'Kagome Inyu';
  
  // Create role element
  const userRole = document.createElement('div');
  userRole.className = 'role';
  userRole.textContent = 'Campaign Owner';
  
  // Append name and role to user info
  userInfo.appendChild(userName);
  userInfo.appendChild(userRole);
  
  // Append avatar and user info to user section
  userSection.appendChild(avatar);
  userSection.appendChild(userInfo);
  
  // Append user section to sidebar
  aside.append(userSection);
  
  block.append(aside);
}
