/*
 * Copyright (c) 2011 OECP All Rights Reserved.                	
 * <a href="http://www.oecp.cn">http://www.oecp.cn</a>                                                                 
 */    

package oecp.framework.util;

/**
 *
 * @author yangtao
 * @date 2011-8-2下午05:18:21
 * @version 1.0
 */

import org.springframework.beans.BeansException;    
import org.springframework.context.ApplicationContext;    
import org.springframework.context.ApplicationContextAware;    
import org.springframework.stereotype.Component;
    /**   
     *   
     * 获取spring容器，以访问容器中定义的其他bean   
     * @author lyltiger  
     * @since MOSTsView 3.0 2009-11-16  
     */  
@Component
public class SpringContextUtil implements ApplicationContextAware {   
  
    // Spring应用上下文环境   
    private static ApplicationContext applicationContext;   
  
    /**  
     * 实现ApplicationContextAware接口的回调方法，设置上下文环境  
     *   
     * @param applicationContext  
     */  
    public void setApplicationContext(ApplicationContext applicationContext) {   
        SpringContextUtil.applicationContext = applicationContext;   
    }   
  
    /**  
     * @return ApplicationContext  
     */  
    public static ApplicationContext getApplicationContext() {   
        return applicationContext;   
    }   
  
    /**  
     * 获取对象  
     * 这里重写了bean方法，起主要作用  
     * @param name  
     * @return Object 一个以所给名字注册的bean的实例  
     * @throws BeansException  
     */  
    public static Object getBean(String name) throws BeansException {   
        return applicationContext.getBean(name);   
    }   
  
} 

