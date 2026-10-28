import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');

/**
 * Closes the open nav dropdown (desktop) or the nav menu (mobile) on Escape
 * @param {KeyboardEvent} e keydown event
 */
function closeOnEscape(e) {
  if (e.code === 'Escape') {
    const nav = document.getElementById('nav');
    const navSections = nav.querySelector('.nav-sections');
    if (!navSections) return;
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections);
      navSectionExpanded.focus();
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections);
      nav.querySelector('button').focus();
    }
  }
}

/**
 * Closes the open nav dropdown (desktop) or the nav menu (mobile) when focus leaves the nav
 * @param {FocusEvent} e focusout event
 */
function closeOnFocusLost(e) {
  const nav = e.currentTarget;
  if (!nav.contains(e.relatedTarget)) {
    const navSections = nav.querySelector('.nav-sections');
    if (!navSections) return;
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections, false);
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections, false);
    }
  }
}

/**
 * Toggles all nav sections
 * @param {Element} sections The container element
 * @param {Boolean|string} expanded Whether the element should be expanded or collapsed
 */
function toggleAllNavSections(sections, expanded = false) {
  if (!sections) return;
  sections.querySelectorAll('.nav-drop > button').forEach((button) => {
    button.setAttribute('aria-expanded', expanded);
  });
}

/**
 * Toggles the entire nav
 * @param {Element} nav The container element
 * @param {Element} navSections The nav sections within the container element
 * @param {*} forceExpanded Optional param to force nav expand behavior when not null
 */
function toggleMenu(nav, navSections, forceExpanded = null) {
  const expanded = forceExpanded !== null ? !forceExpanded : nav.getAttribute('aria-expanded') === 'true';
  const button = nav.querySelector('.nav-hamburger button');
  document.body.style.overflowY = (expanded || isDesktop.matches) ? '' : 'hidden';
  // the desktop nav is always expanded, so aria-expanded only applies to the mobile menu
  if (isDesktop.matches) nav.removeAttribute('aria-expanded');
  else nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  toggleAllNavSections(navSections, expanded || isDesktop.matches ? 'false' : 'true');
  button.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');

  // enable menu collapse on escape keypress
  if (!expanded || isDesktop.matches) {
    // collapse menu on escape press
    window.addEventListener('keydown', closeOnEscape);
    // collapse menu on focus lost
    nav.addEventListener('focusout', closeOnFocusLost);
  } else {
    window.removeEventListener('keydown', closeOnEscape);
    nav.removeEventListener('focusout', closeOnFocusLost);
  }
}

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
  
  block.append(aside);
}
